from __future__ import annotations

import asyncio
import logging
import re
import shutil
from pathlib import Path

from app.core.config import settings
from app.services.reconstruction.job_manager import StageStatus, update_stage_sync as update_stage

logger = logging.getLogger(__name__)

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".dng", ".cr2", ".arw", ".nef"}


async def extract_frames(
    project_id: str,
    input_dir: Path,
    output_dir: Path,
    fps: int = 2,
) -> int:
    """Extract frames from video files and copy images to output_dir.

    Returns the total number of frames produced.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    update_stage(project_id, "frames", status=StageStatus.RUNNING, progress=0)

    videos = [f for f in input_dir.iterdir() if f.suffix.lower() in VIDEO_EXTENSIONS]
    images = [f for f in input_dir.iterdir() if f.suffix.lower() in IMAGE_EXTENSIONS]
    total_sources = len(videos) + (1 if images else 0)
    completed = 0
    frame_count = 0

    # Extract frames from each video
    for video in videos:
        logger.info("Extracting frames from %s at %d fps", video.name, fps)
        prefix = video.stem
        cmd = [
            settings.ffmpeg_binary,
            "-i", str(video),
            "-vf", f"fps={fps}",
            "-q:v", "2",
            str(output_dir / f"{prefix}_%05d.jpg"),
            "-y",
        ]

        import subprocess
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(cmd, capture_output=True),
        )

        if result.returncode != 0:
            error_msg = result.stderr.decode(errors="replace")[-500:]
            logger.error("ffmpeg failed for %s: %s", video.name, error_msg)
            update_stage(project_id, "frames", error=f"ffmpeg failed: {error_msg}")
            raise RuntimeError(f"ffmpeg failed for {video.name}")

        # Count extracted frames
        extracted = len([f for f in output_dir.glob(f"{prefix}_*.jpg")])
        frame_count += extracted
        completed += 1
        pct = int((completed / total_sources) * 100) if total_sources > 0 else 100
        update_stage(project_id, "frames", progress=pct, stats={"frames": str(frame_count)})

    # Copy existing images
    for img in images:
        dest = output_dir / img.name
        if not dest.exists():
            shutil.copy2(img, dest)
            frame_count += 1

    if frame_count == 0:
        update_stage(project_id, "frames", error="No frames extracted — upload video or images")
        raise RuntimeError("No frames extracted")

    update_stage(
        project_id, "frames",
        status=StageStatus.COMPLETED,
        progress=100,
        stats={"frames": str(frame_count)},
    )
    logger.info("Frame extraction complete: %d frames", frame_count)
    return frame_count
