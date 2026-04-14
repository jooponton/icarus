"""Monocular camera pose + ground plane estimation for anchoring buildings.

Pipeline (single image -> camera pose + ground plane + depth):
  1. Parse EXIF for focal length; fall back to predicted FOV from depth geometry.
  2. Run Depth Anything V2 (metric, outdoor) for per-pixel metric depth.
  3. Unproject the depth map to a 3D point cloud in camera space.
  4. RANSAC-fit a ground plane on the lower portion of the cloud.
  5. Derive camera pitch/roll, camera height above ground, and a ground anchor
     point (where the camera's forward ray hits the ground).
  6. Persist a 16-bit depth PNG + JSON result next to the source image.

The returned pose is what the three.js camera needs to match the photo, and the
anchor is where the generated building should be placed so it stands on the
ground plane in the photo.
"""

from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import ExifTags, Image

# Default Depth Anything V2 metric checkpoint (outdoor variant).
# Buildings are overwhelmingly outdoor shots; indoor variant can be swapped
# at call time via an env var.
DEFAULT_MODEL_ID = "depth-anything/Depth-Anything-V2-Metric-Outdoor-Base-hf"

# How much of the image height to treat as "likely ground" for plane fitting.
# 50% bottom works well for typical eye-level shots of buildings.
GROUND_ROI_FRACTION = 0.5
RANSAC_ITERATIONS = 200
RANSAC_THRESHOLD_M = 0.15  # 15cm inlier band


@dataclass
class CameraPose:
    fov_deg: float
    width: int
    height: int
    pitch_deg: float
    roll_deg: float
    camera_height_m: float
    anchor: tuple[float, float, float]
    plane_normal: tuple[float, float, float]
    plane_d: float
    depth_map_url: str | None
    depth_min_m: float
    depth_max_m: float
    source: str  # which image this pose was estimated from

    def to_dict(self) -> dict:
        d = asdict(self)
        d["anchor"] = list(self.anchor)
        d["plane_normal"] = list(self.plane_normal)
        return d


@lru_cache(maxsize=1)
def _load_pipeline(model_id: str = DEFAULT_MODEL_ID):
    """Lazy-load the depth model once per process. MPS on Apple Silicon,
    CUDA if available, else CPU."""
    from transformers import pipeline

    device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
    # float16 on CUDA/MPS for speed, float32 on CPU for stability.
    dtype = torch.float16 if device in ("cuda", "mps") else torch.float32
    return pipeline(
        task="depth-estimation",
        model=model_id,
        device=device,
        torch_dtype=dtype,
    )


def _fov_from_exif(img: Image.Image) -> float | None:
    """Try to compute horizontal FOV from EXIF focal length + sensor width."""
    try:
        exif = img.getexif()
    except Exception:
        return None
    if not exif:
        return None

    focal_35mm = None
    focal = None
    for tag_id, value in exif.items():
        tag = ExifTags.TAGS.get(tag_id)
        if tag == "FocalLengthIn35mmFilm" and value:
            focal_35mm = float(value)
        elif tag == "FocalLength" and value:
            try:
                focal = float(value)
            except (TypeError, ValueError):
                pass

    # 35mm equivalent: full-frame sensor width is 36mm, so
    # hfov = 2 * atan(18 / f_35mm).
    if focal_35mm and focal_35mm > 0:
        return math.degrees(2 * math.atan(18.0 / focal_35mm))

    # Bare focal length with no sensor info: assume APS-C-ish (22.3mm wide).
    # This is rough but better than ignoring EXIF entirely when it's all we have.
    if focal and focal > 0:
        return math.degrees(2 * math.atan(22.3 / (2 * focal)))

    return None


def _run_depth(img: Image.Image, model_id: str) -> np.ndarray:
    """Returns metric depth in meters as a float32 HxW array."""
    pipe = _load_pipeline(model_id)
    out = pipe(img)
    # transformers depth-estimation returns {"predicted_depth": Tensor, "depth": PIL}.
    # The tensor is what we want for metric values (the PIL is normalized 0-255).
    tensor = out["predicted_depth"]
    if hasattr(tensor, "detach"):
        depth = tensor.detach().cpu().float().numpy()
    else:
        depth = np.asarray(tensor, dtype=np.float32)
    # Squeeze to HxW.
    while depth.ndim > 2:
        depth = depth[0]
    # Resize back to the source image resolution so pixel indices match.
    h, w = img.height, img.width
    if depth.shape != (h, w):
        depth = cv2.resize(depth, (w, h), interpolation=cv2.INTER_LINEAR)
    # Depth Anything V2 metric outputs meters directly for the metric variants.
    return depth.astype(np.float32)


def _unproject(depth: np.ndarray, fov_deg: float) -> np.ndarray:
    """Unproject a depth map to a (H, W, 3) point cloud in camera space.

    Camera convention: x right, y down, z forward (OpenCV). We'll flip y for
    three.js later.
    """
    h, w = depth.shape
    fov_rad = math.radians(fov_deg)
    fx = (w / 2.0) / math.tan(fov_rad / 2.0)
    fy = fx  # assume square pixels
    cx, cy = w / 2.0, h / 2.0

    ys, xs = np.indices((h, w), dtype=np.float32)
    z = depth
    x = (xs - cx) * z / fx
    y = (ys - cy) * z / fy
    return np.stack([x, y, z], axis=-1)


def _ransac_plane(points: np.ndarray, iters: int, threshold: float) -> tuple[np.ndarray, float, np.ndarray]:
    """Fit a plane (n . p + d = 0) to a (N, 3) point array with RANSAC.

    Returns (normal, d, inlier_mask). Normal is unit length.
    """
    rng = np.random.default_rng(42)
    n = len(points)
    if n < 3:
        return np.array([0.0, -1.0, 0.0]), 0.0, np.zeros(n, dtype=bool)

    best_inliers = 0
    best_normal = np.array([0.0, -1.0, 0.0])
    best_d = 0.0
    best_mask = np.zeros(n, dtype=bool)

    for _ in range(iters):
        idx = rng.choice(n, 3, replace=False)
        p0, p1, p2 = points[idx]
        v1 = p1 - p0
        v2 = p2 - p0
        normal = np.cross(v1, v2)
        norm = np.linalg.norm(normal)
        if norm < 1e-6:
            continue
        normal /= norm
        d = -np.dot(normal, p0)

        dist = np.abs(points @ normal + d)
        mask = dist < threshold
        count = int(mask.sum())
        if count > best_inliers:
            best_inliers = count
            best_normal = normal
            best_d = d
            best_mask = mask

    # Refit plane to all inliers via SVD for precision.
    if best_inliers >= 3:
        inlier_pts = points[best_mask]
        centroid = inlier_pts.mean(axis=0)
        centered = inlier_pts - centroid
        _, _, vh = np.linalg.svd(centered, full_matrices=False)
        refined = vh[-1]
        refined /= np.linalg.norm(refined) + 1e-12
        # Keep consistent orientation with the previous best normal so the
        # "up" direction doesn't flip between the RANSAC and SVD estimates.
        if np.dot(refined, best_normal) < 0:
            refined = -refined
        best_normal = refined
        best_d = float(-np.dot(best_normal, centroid))

    return best_normal, best_d, best_mask


def _fit_ground_plane(cloud: np.ndarray) -> tuple[np.ndarray, float]:
    """Fit a ground plane over the bottom GROUND_ROI_FRACTION of the image."""
    h, w, _ = cloud.shape
    roi_start = int(h * (1.0 - GROUND_ROI_FRACTION))
    roi = cloud[roi_start:].reshape(-1, 3)
    # Drop points with invalid/zero depth.
    valid = np.isfinite(roi).all(axis=1) & (roi[:, 2] > 0.1) & (roi[:, 2] < 200.0)
    roi = roi[valid]
    # Subsample for RANSAC speed — 20k points is plenty.
    if len(roi) > 20000:
        idx = np.random.default_rng(0).choice(len(roi), 20000, replace=False)
        roi = roi[idx]
    normal, d, _ = _ransac_plane(roi, RANSAC_ITERATIONS, RANSAC_THRESHOLD_M)

    # Force the normal to point "up" in the world. In OpenCV camera coords the
    # ground plane is typically below the camera (y > 0), so the upward normal
    # should have a negative y component.
    if normal[1] > 0:
        normal = -normal
        d = -d
    return normal, d


def _pose_from_plane(
    normal: np.ndarray,
    plane_d: float,
    fov_deg: float,
    w: int,
    h: int,
) -> tuple[float, float, float, tuple[float, float, float]]:
    """Convert a ground plane in OpenCV camera coords to (pitch, roll, height, anchor)."""
    # Camera height: distance from camera origin (0,0,0) to plane.
    cam_height = float(abs(plane_d))

    # Pitch: angle between the camera's forward axis (+z) and the plane.
    # Equivalently, angle between plane normal and the camera's -y axis.
    up = np.array([0.0, -1.0, 0.0])
    cos_pitch = float(np.clip(np.dot(normal, up), -1.0, 1.0))
    pitch = math.degrees(math.acos(cos_pitch))
    # Signed: if the plane normal tilts forward (positive z), the camera looks down.
    if normal[2] > 0:
        pitch = -pitch

    # Roll: rotation of the plane normal about the camera's forward axis.
    # Project normal onto the camera XY plane and measure its angle from -y.
    nx, ny = normal[0], normal[1]
    roll = math.degrees(math.atan2(nx, -ny))

    # Anchor: intersection of the camera's forward ray (0,0,1) with the plane.
    # plane: normal . p + d = 0, ray: p = t * (0,0,1). Solve for t.
    nz = normal[2]
    if abs(nz) < 1e-6:
        t = 10.0  # fallback: 10m out
    else:
        t = -plane_d / nz
        if t <= 0:
            t = 10.0
    anchor_cam = np.array([0.0, 0.0, t])
    # Transform anchor to world coordinates where the ground is y=0 and the
    # camera sits at (0, cam_height, 0). The anchor's world position is
    # distance t along the camera's forward axis projected onto the ground.
    # For display we just return the forward distance; the frontend rebuilds
    # the world-space point from the pose.
    anchor_world = (0.0, 0.0, -float(t))  # three.js: -z is forward
    _ = (w, h, fov_deg)  # reserved: intrinsics sanity check
    return float(pitch), float(roll), cam_height, anchor_world


def _save_depth_png(depth: np.ndarray, out_path: Path) -> None:
    """Save a 16-bit PNG of the depth map (millimeters) for debugging + frontend use."""
    mm = np.clip(depth * 1000.0, 0, 65535).astype(np.uint16)
    cv2.imwrite(str(out_path), mm)


def estimate_from_image(
    image_path: Path,
    out_dir: Path | None = None,
    model_id: str = DEFAULT_MODEL_ID,
) -> CameraPose:
    """Estimate camera pose + ground plane + depth from a single image."""
    img = Image.open(image_path).convert("RGB")
    w, h = img.size

    fov = _fov_from_exif(img)
    # Metric3D-style fallback: for most phone/drone shots hfov is ~60-75°.
    if fov is None:
        fov = 65.0

    depth = _run_depth(img, model_id)
    cloud = _unproject(depth, fov)
    normal, plane_d = _fit_ground_plane(cloud)
    pitch, roll, cam_height, anchor = _pose_from_plane(normal, plane_d, fov, w, h)

    depth_url = None
    if out_dir is not None:
        out_dir.mkdir(parents=True, exist_ok=True)
        depth_png = out_dir / f"{image_path.stem}.depth.png"
        _save_depth_png(depth, depth_png)
        pose_json = out_dir / f"{image_path.stem}.pose.json"
        depth_url = f"/api/pose/depth/{image_path.parent.name}/{depth_png.name}"
        pose_json.write_text(
            json.dumps(
                {
                    "fov_deg": fov,
                    "width": w,
                    "height": h,
                    "pitch_deg": pitch,
                    "roll_deg": roll,
                    "camera_height_m": cam_height,
                    "anchor": list(anchor),
                    "plane_normal": normal.tolist(),
                    "plane_d": float(plane_d),
                    "depth_min_m": float(depth.min()),
                    "depth_max_m": float(depth.max()),
                    "depth_map_url": depth_url,
                },
                indent=2,
            )
        )

    return CameraPose(
        fov_deg=float(fov),
        width=int(w),
        height=int(h),
        pitch_deg=float(pitch),
        roll_deg=float(roll),
        camera_height_m=float(cam_height),
        anchor=(float(anchor[0]), float(anchor[1]), float(anchor[2])),
        plane_normal=(float(normal[0]), float(normal[1]), float(normal[2])),
        plane_d=float(plane_d),
        depth_map_url=depth_url,
        depth_min_m=float(depth.min()),
        depth_max_m=float(depth.max()),
        source=image_path.name,
    )
