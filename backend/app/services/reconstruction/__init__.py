from __future__ import annotations

import logging
from pathlib import Path

from app.core.config import settings
from app.services.reconstruction.job_manager import (
    StageStatus,
    create_job,
    mark_splat_ready,
    update_stage,
)
from app.services.reconstruction.frame_extractor import extract_frames
from app.services.reconstruction.colmap import run_colmap_pipeline
from app.services.reconstruction.gaussian_splatting import train_gaussian_splatting
from app.services.reconstruction.splat_converter import convert_ply_to_splat

logger = logging.getLogger(__name__)


async def run_reconstruction_pipeline(project_id: str) -> None:
    """Top-level orchestrator for the full reconstruction pipeline.

    Stages:
    1. Frame extraction (video → images)
    2. COLMAP feature extraction + matching
    3. COLMAP sparse reconstruction (mapper)
    4. Gaussian Splatting training
    5. PLY → .splat conversion
    """
    raw_dir = settings.upload_dir / project_id
    processed_dir = settings.processed_dir / project_id
    processed_dir.mkdir(parents=True, exist_ok=True)

    frames_dir = raw_dir / "frames"
    colmap_dir = processed_dir / "colmap"

    try:
        # Stage 1: Extract frames from video / collect images
        logger.info("[%s] Stage 1: Frame extraction", project_id)
        frame_count = await extract_frames(project_id, raw_dir, frames_dir)
        logger.info("[%s] Extracted %d frames", project_id, frame_count)

        # Stage 2+3: COLMAP pipeline (feature extraction + sparse reconstruction)
        logger.info("[%s] Stage 2-3: COLMAP pipeline", project_id)
        sparse_model_dir = await run_colmap_pipeline(project_id, frames_dir, colmap_dir)
        logger.info("[%s] COLMAP complete: %s", project_id, sparse_model_dir)

        # Stage 4: Gaussian Splatting training
        logger.info("[%s] Stage 4: Gaussian Splatting training", project_id)
        ply_path = await train_gaussian_splatting(
            project_id, colmap_dir, frames_dir, processed_dir,
        )
        logger.info("[%s] Training complete: %s", project_id, ply_path)

        # Stage 5: Convert PLY to .splat
        logger.info("[%s] Stage 5: PLY → .splat conversion", project_id)
        splat_path = processed_dir / "splat.splat"
        update_stage(project_id, "convert", status=StageStatus.RUNNING, progress=0)
        convert_ply_to_splat(ply_path, splat_path)
        update_stage(
            project_id, "convert",
            status=StageStatus.COMPLETED,
            progress=100,
            stats={"size": f"{splat_path.stat().st_size / (1024*1024):.0f} MB"},
        )

        mark_splat_ready(project_id)
        logger.info("[%s] Reconstruction pipeline complete!", project_id)

    except Exception as e:
        logger.exception("[%s] Pipeline failed: %s", project_id, e)
        # Stage errors are already set by individual services
        raise
