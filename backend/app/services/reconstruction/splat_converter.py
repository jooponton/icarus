from __future__ import annotations

import logging
import struct
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

# SH coefficient C0 constant for converting SH to RGB
SH_C0 = 0.28209479177387814


def convert_ply_to_splat(ply_path: Path, splat_path: Path) -> None:
    """Convert a 3D Gaussian Splatting PLY file to .splat format for web viewing.

    The .splat format packs 32 bytes per gaussian:
      - position: 3x float32 (12 bytes)
      - scale: 3x float32 (12 bytes)
      - color: 4x uint8 RGBA (4 bytes)
      - rotation: 4x uint8 normalized quaternion (4 bytes)
    """
    logger.info("Converting PLY to splat: %s -> %s", ply_path, splat_path)

    with open(ply_path, "rb") as f:
        header, vertex_count, properties = _parse_ply_header(f)
        data = _read_ply_vertices(f, vertex_count, properties)

    # Sort by scale (largest first) for better rendering
    scales = np.exp(data["scale"])
    sort_idx = np.argsort(-(scales[:, 0] * scales[:, 1] * scales[:, 2]))

    with open(splat_path, "wb") as f:
        for i in sort_idx:
            # Position (3x float32)
            f.write(struct.pack("<fff", data["x"][i], data["y"][i], data["z"][i]))

            # Scale (3x float32) — already exponentiated
            f.write(struct.pack("<fff", scales[i, 0], scales[i, 1], scales[i, 2]))

            # Color (4x uint8) — convert SH DC to RGB + sigmoid opacity
            r = _sh_to_color(data["f_dc"][i, 0])
            g = _sh_to_color(data["f_dc"][i, 1])
            b = _sh_to_color(data["f_dc"][i, 2])
            a = _sigmoid(data["opacity"][i])
            f.write(struct.pack("<BBBB",
                _clamp_uint8(r),
                _clamp_uint8(g),
                _clamp_uint8(b),
                _clamp_uint8(a),
            ))

            # Rotation quaternion (4x uint8, normalized to 0-255)
            quat = data["rot"][i]
            norm = np.sqrt(np.sum(quat ** 2))
            if norm > 0:
                quat = quat / norm
            f.write(struct.pack("<BBBB",
                _quat_to_uint8(quat[0]),
                _quat_to_uint8(quat[1]),
                _quat_to_uint8(quat[2]),
                _quat_to_uint8(quat[3]),
            ))

    size_mb = splat_path.stat().st_size / (1024 * 1024)
    logger.info("Splat conversion complete: %d gaussians, %.1f MB", vertex_count, size_mb)


def _parse_ply_header(f):
    """Parse PLY header and return (header_text, vertex_count, property_list)."""
    header_lines = []
    vertex_count = 0
    properties = []

    while True:
        line = f.readline().decode("ascii", errors="replace").strip()
        header_lines.append(line)
        if line.startswith("element vertex"):
            vertex_count = int(line.split()[-1])
        elif line.startswith("property"):
            parts = line.split()
            dtype = parts[1]
            name = parts[2]
            properties.append((name, dtype))
        elif line == "end_header":
            break

    return "\n".join(header_lines), vertex_count, properties


def _read_ply_vertices(f, count: int, properties: list[tuple[str, str]]) -> dict:
    """Read binary vertex data from PLY file into structured arrays."""
    dtype_map = {
        "float": "f4",
        "double": "f8",
        "uchar": "u1",
        "int": "i4",
        "uint": "u4",
        "short": "i2",
        "ushort": "u2",
    }

    np_dtype = [(name, dtype_map.get(dtype, "f4")) for name, dtype in properties]
    raw = np.frombuffer(f.read(count * np.dtype(np_dtype).itemsize), dtype=np_dtype, count=count)

    result = {}

    # Position
    result["x"] = raw["x"].astype(np.float32)
    result["y"] = raw["y"].astype(np.float32)
    result["z"] = raw["z"].astype(np.float32)

    # SH DC coefficients (color)
    f_dc_names = [n for n, _ in properties if n.startswith("f_dc_")]
    if f_dc_names:
        result["f_dc"] = np.column_stack([raw[n].astype(np.float32) for n in f_dc_names[:3]])
    else:
        # Fallback to vertex colors
        result["f_dc"] = np.column_stack([
            raw.get("red", np.zeros(count)).astype(np.float32) / 255.0,
            raw.get("green", np.zeros(count)).astype(np.float32) / 255.0,
            raw.get("blue", np.zeros(count)).astype(np.float32) / 255.0,
        ])

    # Opacity
    if "opacity" in raw.dtype.names:
        result["opacity"] = raw["opacity"].astype(np.float32)
    else:
        result["opacity"] = np.zeros(count, dtype=np.float32)

    # Scale
    scale_names = [n for n, _ in properties if n.startswith("scale_")]
    if scale_names:
        result["scale"] = np.column_stack([raw[n].astype(np.float32) for n in scale_names[:3]])
    else:
        result["scale"] = np.zeros((count, 3), dtype=np.float32)

    # Rotation quaternion
    rot_names = [n for n, _ in properties if n.startswith("rot_")]
    if rot_names:
        result["rot"] = np.column_stack([raw[n].astype(np.float32) for n in rot_names[:4]])
    else:
        result["rot"] = np.tile([1.0, 0.0, 0.0, 0.0], (count, 1)).astype(np.float32)

    return result


def _sh_to_color(sh_dc: float) -> float:
    """Convert zeroth-order SH coefficient to color value [0, 1]."""
    return 0.5 + SH_C0 * sh_dc


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


def _clamp_uint8(v: float) -> int:
    return max(0, min(255, int(v * 255)))


def _quat_to_uint8(v: float) -> int:
    """Map quaternion component [-1, 1] to [0, 255]."""
    return max(0, min(255, int((v + 1.0) * 0.5 * 255)))
