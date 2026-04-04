from __future__ import annotations

import asyncio
import logging
import struct
from pathlib import Path

import numpy as np
import torch

from app.core.config import settings
from app.services.reconstruction.job_manager import StageStatus, update_stage_sync as update_stage

logger = logging.getLogger(__name__)


async def train_gaussian_splatting(
    project_id: str,
    colmap_dir: Path,
    image_dir: Path,
    output_dir: Path,
    iterations: int | None = None,
) -> Path:
    """Train 3D Gaussian Splatting using gsplat library.

    Returns path to the output point_cloud.ply file.
    """
    if iterations is None:
        iterations = settings.splat_training_iterations

    update_stage(project_id, "dense", status=StageStatus.RUNNING, progress=0)

    ply_path = output_dir / "point_cloud.ply"

    # Run training in a thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(
            None,
            _train_sync,
            project_id, colmap_dir, image_dir, ply_path, iterations,
        )
    except Exception as e:
        update_stage(project_id, "dense", error=str(e))
        raise

    update_stage(
        project_id, "dense",
        status=StageStatus.COMPLETED,
        progress=100,
        stats={"iterations": str(iterations)},
    )
    return ply_path


def _train_sync(
    project_id: str,
    colmap_dir: Path,
    image_dir: Path,
    ply_path: Path,
    iterations: int,
) -> None:
    """Synchronous training using gsplat — runs in thread pool."""
    from gsplat import rasterization

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Training on device: %s", device)

    # Load COLMAP sparse model
    means, colors, opacities = _load_colmap_points(colmap_dir / "sparse" / "0", device)
    N = means.shape[0]
    logger.info("Loaded %d points from COLMAP", N)

    if N == 0:
        raise RuntimeError("No points loaded from COLMAP sparse model")

    # Load camera parameters and images
    cameras, images_meta = _load_colmap_cameras(colmap_dir / "sparse" / "0", device)
    image_data = _load_images(image_dir, images_meta)
    logger.info("Loaded %d training views", len(image_data))

    if len(image_data) == 0:
        raise RuntimeError("No training images loaded")

    # Initialize gaussian parameters
    means = means.requires_grad_(True)
    scales = torch.full((N, 3), -3.0, device=device, requires_grad=True)  # log scale
    quats = torch.zeros((N, 4), device=device)
    quats[:, 0] = 1.0  # identity quaternion
    quats = quats.requires_grad_(True)
    opacities_logit = torch.logit(opacities.clamp(0.01, 0.99)).requires_grad_(True)

    # SH coefficients (degree 0 only for speed)
    sh0 = (colors - 0.5) / 0.28209479177387814  # inverse of SH_C0
    sh_coeffs = sh0.unsqueeze(1).requires_grad_(True)  # (N, 1, 3)

    optimizer = torch.optim.Adam([
        {"params": [means], "lr": 1.6e-4},
        {"params": [scales], "lr": 5e-3},
        {"params": [quats], "lr": 1e-3},
        {"params": [opacities_logit], "lr": 5e-2},
        {"params": [sh_coeffs], "lr": 2.5e-3},
    ])

    # Training loop
    num_views = len(image_data)
    for step in range(iterations):
        optimizer.zero_grad()

        # Pick random training view
        view_idx = step % num_views
        view = image_data[view_idx]
        gt_image = view["image"].to(device)  # (H, W, 3)
        viewmat = view["viewmat"].to(device)  # (4, 4)
        K = view["K"].to(device)  # (3, 3)
        H, W = gt_image.shape[:2]

        # Rasterize
        renders, alphas, meta = rasterization(
            means=means,
            quats=quats / quats.norm(dim=-1, keepdim=True),
            scales=torch.exp(scales),
            opacities=torch.sigmoid(opacities_logit),
            colors=sh_coeffs,
            viewmats=viewmat.unsqueeze(0),
            Ks=K.unsqueeze(0),
            width=W,
            height=H,
            sh_degree=0,
        )

        rendered = renders[0]  # (H, W, 3)
        loss = torch.nn.functional.l1_loss(rendered, gt_image)
        loss.backward()
        optimizer.step()

        if step % 100 == 0:
            pct = int((step / iterations) * 100)
            update_stage(
                project_id, "dense",
                progress=pct,
                stats={
                    "iteration": f"{step}/{iterations}",
                    "loss": f"{loss.item():.4f}",
                    "gaussians": str(N),
                },
            )
            logger.info("Step %d/%d, loss=%.4f", step, iterations, loss.item())

    # Export to PLY
    _save_ply(
        ply_path,
        means=means.detach().cpu().numpy(),
        scales=scales.detach().cpu().numpy(),
        quats=quats.detach().cpu().numpy(),
        opacities=torch.sigmoid(opacities_logit).detach().cpu().numpy(),
        sh_coeffs=sh_coeffs.detach().cpu().numpy(),
    )
    logger.info("Saved PLY to %s", ply_path)


def _load_colmap_points(sparse_dir: Path, device: torch.device):
    """Load 3D points from COLMAP binary format."""
    points_path = sparse_dir / "points3D.bin"
    if not points_path.exists():
        return (
            torch.zeros((0, 3), device=device),
            torch.zeros((0, 3), device=device),
            torch.zeros((0,), device=device),
        )

    with open(points_path, "rb") as f:
        num_points = struct.unpack("<Q", f.read(8))[0]
        means_list = []
        colors_list = []

        for _ in range(num_points):
            point_id = struct.unpack("<Q", f.read(8))[0]
            xyz = struct.unpack("<ddd", f.read(24))
            rgb = struct.unpack("<BBB", f.read(3))
            error = struct.unpack("<d", f.read(8))[0]
            track_length = struct.unpack("<Q", f.read(8))[0]
            # Skip track data (image_id + point2d_idx per track)
            f.read(track_length * 8)

            means_list.append(xyz)
            colors_list.append([c / 255.0 for c in rgb])

    means = torch.tensor(means_list, dtype=torch.float32, device=device)
    colors = torch.tensor(colors_list, dtype=torch.float32, device=device)
    opacities = torch.full((len(means_list),), 0.5, device=device)

    return means, colors, opacities


def _load_colmap_cameras(sparse_dir: Path, device: torch.device):
    """Load camera intrinsics and image extrinsics from COLMAP binary."""
    import collections

    Camera = collections.namedtuple("Camera", ["id", "model", "width", "height", "params"])
    ImageMeta = collections.namedtuple("ImageMeta", ["id", "qvec", "tvec", "camera_id", "name"])

    cameras = {}
    cameras_path = sparse_dir / "cameras.bin"
    if cameras_path.exists():
        with open(cameras_path, "rb") as f:
            num_cameras = struct.unpack("<Q", f.read(8))[0]
            for _ in range(num_cameras):
                cam_id = struct.unpack("<I", f.read(4))[0]
                model_id = struct.unpack("<I", f.read(4))[0]
                width = struct.unpack("<Q", f.read(8))[0]
                height = struct.unpack("<Q", f.read(8))[0]
                # Model params: SIMPLE_PINHOLE=3, PINHOLE=4, etc.
                num_params = {0: 3, 1: 4, 2: 4, 3: 5}.get(model_id, 4)
                params = struct.unpack(f"<{num_params}d", f.read(num_params * 8))
                cameras[cam_id] = Camera(cam_id, model_id, width, height, params)

    images_meta = []
    images_path = sparse_dir / "images.bin"
    if images_path.exists():
        with open(images_path, "rb") as f:
            num_images = struct.unpack("<Q", f.read(8))[0]
            for _ in range(num_images):
                img_id = struct.unpack("<I", f.read(4))[0]
                qvec = struct.unpack("<dddd", f.read(32))
                tvec = struct.unpack("<ddd", f.read(24))
                cam_id = struct.unpack("<I", f.read(4))[0]
                name = b""
                while True:
                    ch = f.read(1)
                    if ch == b"\x00":
                        break
                    name += ch
                num_points2d = struct.unpack("<Q", f.read(8))[0]
                f.read(num_points2d * 24)  # skip 2D points
                images_meta.append(ImageMeta(img_id, qvec, tvec, cam_id, name.decode()))

    return cameras, images_meta


def _load_images(image_dir: Path, images_meta, max_images: int = 100):
    """Load training images and compute view/projection matrices."""
    import cv2

    # Get parent cameras dict from the calling context — we re-load here
    cameras = {}
    sparse_dir = image_dir.parent
    # Try multiple possible sparse dirs
    for candidate in [
        sparse_dir / "colmap" / "sparse" / "0",
        sparse_dir.parent / "colmap" / "sparse" / "0",
    ]:
        if (candidate / "cameras.bin").exists():
            cameras, _ = _load_colmap_cameras(candidate, torch.device("cpu"))
            break

    results = []
    step = max(1, len(images_meta) // max_images)

    for i, img_meta in enumerate(images_meta[::step]):
        img_path = image_dir / img_meta.name
        if not img_path.exists():
            continue

        img = cv2.imread(str(img_path))
        if img is None:
            continue
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        cam = cameras.get(img_meta.camera_id)
        if cam is None:
            continue

        # Resize for training speed
        target_h = min(img.shape[0], 800)
        scale = target_h / img.shape[0]
        target_w = int(img.shape[1] * scale)
        img = cv2.resize(img, (target_w, target_h))

        # Build intrinsic matrix
        fx = cam.params[0] * scale
        fy = cam.params[1] * scale if len(cam.params) > 1 and cam.model in [1, 2, 3] else fx
        cx = (cam.params[-2] if len(cam.params) >= 3 else cam.width / 2) * scale
        cy = (cam.params[-1] if len(cam.params) >= 4 else cam.height / 2) * scale

        K = torch.tensor([
            [fx, 0, cx],
            [0, fy, cy],
            [0, 0, 1],
        ], dtype=torch.float32)

        # Build view matrix from quaternion + translation
        q = np.array(img_meta.qvec)
        t = np.array(img_meta.tvec)
        R = _qvec2rotmat(q)
        viewmat = torch.eye(4, dtype=torch.float32)
        viewmat[:3, :3] = torch.tensor(R, dtype=torch.float32)
        viewmat[:3, 3] = torch.tensor(t, dtype=torch.float32)

        results.append({
            "image": torch.tensor(img / 255.0, dtype=torch.float32),
            "viewmat": viewmat,
            "K": K,
        })

    return results


def _qvec2rotmat(qvec):
    """Convert COLMAP quaternion (w, x, y, z) to rotation matrix."""
    w, x, y, z = qvec
    return np.array([
        [1 - 2*y*y - 2*z*z, 2*x*y - 2*z*w, 2*x*z + 2*y*w],
        [2*x*y + 2*z*w, 1 - 2*x*x - 2*z*z, 2*y*z - 2*x*w],
        [2*x*z - 2*y*w, 2*y*z + 2*x*w, 1 - 2*x*x - 2*y*y],
    ])


def _save_ply(
    path: Path,
    means: np.ndarray,
    scales: np.ndarray,
    quats: np.ndarray,
    opacities: np.ndarray,
    sh_coeffs: np.ndarray,
) -> None:
    """Save gaussian parameters as PLY file (3DGS format)."""
    N = means.shape[0]
    # SH DC coefficients
    f_dc = sh_coeffs[:, 0, :]  # (N, 3)

    header = f"""ply
format binary_little_endian 1.0
element vertex {N}
property float x
property float y
property float z
property float nx
property float ny
property float nz
property float f_dc_0
property float f_dc_1
property float f_dc_2
property float opacity
property float scale_0
property float scale_1
property float scale_2
property float rot_0
property float rot_1
property float rot_2
property float rot_3
end_header
"""

    with open(path, "wb") as f:
        f.write(header.encode("ascii"))
        for i in range(N):
            # position
            f.write(struct.pack("<fff", means[i, 0], means[i, 1], means[i, 2]))
            # normals (unused)
            f.write(struct.pack("<fff", 0, 0, 0))
            # SH DC
            f.write(struct.pack("<fff", f_dc[i, 0], f_dc[i, 1], f_dc[i, 2]))
            # opacity (logit form)
            op_logit = np.log(opacities[i] / (1 - opacities[i] + 1e-8))
            f.write(struct.pack("<f", op_logit))
            # scale (log form)
            f.write(struct.pack("<fff", scales[i, 0], scales[i, 1], scales[i, 2]))
            # rotation quaternion
            q = quats[i]
            qnorm = np.sqrt(np.sum(q ** 2))
            if qnorm > 0:
                q = q / qnorm
            f.write(struct.pack("<ffff", q[0], q[1], q[2], q[3]))

    logger.info("Saved %d gaussians to %s (%.1f MB)", N, path, path.stat().st_size / 1e6)
