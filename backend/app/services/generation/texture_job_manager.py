from __future__ import annotations

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class StageStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"


class TextureStageInfo(BaseModel):
    id: str
    name: str
    status: StageStatus = StageStatus.PENDING
    progress: int = 0
    error: Optional[str] = None


class TextureJobStatus(BaseModel):
    project_id: str
    spec_hash: str
    stages: list[TextureStageInfo]
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    textures_ready: bool = False


DEFAULT_STAGES = [
    TextureStageInfo(id="wall", name="Wall texture"),
    TextureStageInfo(id="roof", name="Roof texture"),
    TextureStageInfo(id="door", name="Door texture"),
    TextureStageInfo(id="trim", name="Trim texture"),
]

# In-memory job store
_jobs: dict[str, TextureJobStatus] = {}


def create_job(project_id: str, spec_hash: str) -> TextureJobStatus:
    job = TextureJobStatus(
        project_id=project_id,
        spec_hash=spec_hash,
        stages=[s.model_copy() for s in DEFAULT_STAGES],
        started_at=datetime.now(timezone.utc),
    )
    _jobs[project_id] = job
    logger.info("Created texture job for project %s (hash: %s)", project_id, spec_hash)
    return job


def get_job(project_id: str) -> Optional[TextureJobStatus]:
    return _jobs.get(project_id)


def update_stage(
    project_id: str,
    stage_id: str,
    *,
    status: Optional[StageStatus] = None,
    progress: Optional[int] = None,
    error: Optional[str] = None,
) -> None:
    job = _jobs.get(project_id)
    if not job:
        return
    for stage in job.stages:
        if stage.id == stage_id:
            if status is not None:
                stage.status = status
            if progress is not None:
                stage.progress = progress
            if error is not None:
                stage.error = error
                stage.status = StageStatus.ERROR
            break


def mark_textures_ready(project_id: str) -> None:
    job = _jobs.get(project_id)
    if job:
        job.textures_ready = True
        job.completed_at = datetime.now(timezone.utc)
