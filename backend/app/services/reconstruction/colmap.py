from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path

from app.core.config import settings
from app.services.reconstruction.job_manager import StageStatus, update_stage

logger = logging.getLogger(__name__)


async def run_colmap_pipeline(
    project_id: str,
    image_dir: Path,
    output_dir: Path,
) -> Path:
    """Run COLMAP sparse reconstruction pipeline.

    Returns path to the sparse model directory (output_dir/sparse/0/).
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    db_path = output_dir / "database.db"
    sparse_dir = output_dir / "sparse"
    sparse_dir.mkdir(parents=True, exist_ok=True)

    # Count images for progress estimation
    image_count = len(list(image_dir.glob("*.jpg"))) + len(list(image_dir.glob("*.png")))

    # Stage 1: Feature extraction
    update_stage(project_id, "feature", status=StageStatus.RUNNING, progress=0)
    await _run_colmap_command(
        [
            settings.colmap_binary, "feature_extractor",
            "--database_path", str(db_path),
            "--image_path", str(image_dir),
            "--ImageReader.single_camera", "1",
            "--FeatureExtraction.use_gpu", "1",
        ],
        project_id=project_id,
        stage_id="feature",
        progress_pattern=r"Processed file \[(\d+)/(\d+)\]",
        total_hint=image_count,
    )
    update_stage(
        project_id, "feature",
        status=StageStatus.COMPLETED,
        progress=100,
        stats={"images": str(image_count)},
    )

    # Stage 2: Exhaustive matching + Sparse reconstruction (mapper)
    # We combine matching + mapper under the "sparse" stage since matching
    # is relatively fast and mapper is the main compute.
    update_stage(project_id, "sparse", status=StageStatus.RUNNING, progress=0)

    # Matching
    await _run_colmap_command(
        [
            settings.colmap_binary, "exhaustive_matcher",
            "--database_path", str(db_path),
            "--FeatureMatching.use_gpu", "1",
        ],
        project_id=project_id,
        stage_id="sparse",
        progress_pattern=r"Matching block \[(\d+)/(\d+)\]",
        progress_cap=40,  # matching is ~40% of this stage
    )

    # Mapper
    await _run_colmap_command(
        [
            settings.colmap_binary, "mapper",
            "--database_path", str(db_path),
            "--image_path", str(image_dir),
            "--output_path", str(sparse_dir),
        ],
        project_id=project_id,
        stage_id="sparse",
        progress_pattern=r"Registering image #(\d+)",
        progress_offset=40,
        progress_cap=100,
        total_hint=image_count,
    )

    # Verify output
    model_dir = sparse_dir / "0"
    if not model_dir.exists():
        update_stage(project_id, "sparse", error="COLMAP mapper produced no output — check image overlap")
        raise RuntimeError("COLMAP mapper failed to produce sparse model")

    point_count = _count_points(model_dir / "points3D.bin")
    update_stage(
        project_id, "sparse",
        status=StageStatus.COMPLETED,
        progress=100,
        stats={"points": f"{point_count // 1000}k" if point_count > 1000 else str(point_count)},
    )
    logger.info("COLMAP sparse reconstruction complete: %d points", point_count)
    return model_dir


async def _run_colmap_command(
    cmd: list[str],
    *,
    project_id: str,
    stage_id: str,
    progress_pattern: str | None = None,
    total_hint: int = 0,
    progress_offset: int = 0,
    progress_cap: int = 100,
) -> None:
    """Run a COLMAP command and parse output for progress updates.

    Uses subprocess.Popen in a thread pool for Windows compatibility
    (asyncio.create_subprocess_exec can fail in BackgroundTask context).
    """
    import subprocess
    import threading

    logger.info("Running: %s", " ".join(cmd))

    pattern = re.compile(progress_pattern) if progress_pattern else None
    range_size = progress_cap - progress_offset

    def _run():
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )

        for raw_line in proc.stdout:
            text = raw_line.decode(errors="replace").strip()
            if not text:
                continue

            if pattern:
                m = pattern.search(text)
                if m:
                    groups = m.groups()
                    if len(groups) == 2:
                        current, total = int(groups[0]), int(groups[1])
                        pct = progress_offset + int((current / max(total, 1)) * range_size)
                    elif len(groups) == 1 and total_hint > 0:
                        current = int(groups[0])
                        pct = progress_offset + int((current / total_hint) * range_size)
                    else:
                        continue
                    pct = min(pct, progress_cap)
                    update_stage(project_id, stage_id, progress=pct)

        proc.wait()
        if proc.returncode != 0:
            error_msg = f"COLMAP command exited with code {proc.returncode}"
            logger.error(error_msg)
            update_stage(project_id, stage_id, error=error_msg)
            raise RuntimeError(error_msg)

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run)


def _count_points(points3d_path: Path) -> int:
    """Rough count of 3D points from COLMAP binary file."""
    if not points3d_path.exists():
        return 0
    try:
        import struct
        with open(points3d_path, "rb") as f:
            num_points = struct.unpack("<Q", f.read(8))[0]
        return num_points
    except Exception:
        # Fallback: estimate from file size (each point ~43 bytes min)
        return max(1, points3d_path.stat().st_size // 64)
