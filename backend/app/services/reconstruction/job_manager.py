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


class StageInfo(BaseModel):
    id: str
    name: str
    status: StageStatus = StageStatus.PENDING
    progress: int = 0
    stats: dict[str, str] = {}
    error: Optional[str] = None


class JobStatus(BaseModel):
    project_id: str
    stages: list[StageInfo]
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    splat_ready: bool = False


DEFAULT_STAGES = [
    StageInfo(id="frames", name="Frame extraction"),
    StageInfo(id="feature", name="Feature extraction"),
    StageInfo(id="sparse", name="Sparse reconstruction"),
    StageInfo(id="dense", name="Gaussian splatting"),
    StageInfo(id="convert", name="Splat conversion"),
]

# In-memory job store
_jobs: dict[str, JobStatus] = {}


def create_job(project_id: str) -> JobStatus:
    job = JobStatus(
        project_id=project_id,
        stages=[s.model_copy() for s in DEFAULT_STAGES],
        started_at=datetime.now(timezone.utc),
    )
    _jobs[project_id] = job
    logger.info("Created reconstruction job for project %s", project_id)
    return job


def get_job(project_id: str) -> Optional[JobStatus]:
    return _jobs.get(project_id)


def update_stage(
    project_id: str,
    stage_id: str,
    *,
    status: Optional[StageStatus] = None,
    progress: Optional[int] = None,
    stats: Optional[dict[str, str]] = None,
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
            if stats is not None:
                stage.stats.update(stats)
            if error is not None:
                stage.error = error
                stage.status = StageStatus.ERROR
            break


def mark_splat_ready(project_id: str) -> None:
    job = _jobs.get(project_id)
    if job:
        job.splat_ready = True
        job.completed_at = datetime.now(timezone.utc)
