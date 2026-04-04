from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import create_engine, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, Session

from app.core.config import settings
from app.models.reconstruction import ReconstructionJob, ReconstructionStage

logger = logging.getLogger(__name__)

# Sync engine for background thread usage (colmap, gaussian splatting threads)
_sync_url = settings.database_url.replace("sqlite+aiosqlite", "sqlite")
_sync_engine = create_engine(_sync_url)


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


def _job_to_status(job: ReconstructionJob) -> JobStatus:
    return JobStatus(
        project_id=job.project_id,
        stages=[
            StageInfo(
                id=s.stage_id,
                name=s.name,
                status=StageStatus(s.status),
                progress=s.progress,
                stats=s.stats or {},
                error=s.error,
            )
            for s in job.stages
        ],
        started_at=job.started_at,
        completed_at=job.completed_at,
        splat_ready=job.splat_ready,
    )


async def create_job(db: AsyncSession, project_id: str) -> JobStatus:
    job = ReconstructionJob(
        project_id=project_id,
        started_at=datetime.now(timezone.utc),
    )
    for s in DEFAULT_STAGES:
        job.stages.append(
            ReconstructionStage(
                stage_id=s.id,
                name=s.name,
                status=s.status.value,
                progress=s.progress,
                stats=s.stats,
            )
        )
    db.add(job)
    await db.commit()
    await db.refresh(job, ["stages"])
    logger.info("Created reconstruction job for project %s", project_id)
    return _job_to_status(job)


async def get_job(db: AsyncSession, project_id: str) -> Optional[JobStatus]:
    result = await db.execute(
        select(ReconstructionJob)
        .where(ReconstructionJob.project_id == project_id)
        .options(selectinload(ReconstructionJob.stages))
        .order_by(ReconstructionJob.id.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if not job:
        return None
    return _job_to_status(job)


async def update_stage(
    db: AsyncSession,
    project_id: str,
    stage_id: str,
    *,
    status: Optional[StageStatus] = None,
    progress: Optional[int] = None,
    stats: Optional[dict[str, str]] = None,
    error: Optional[str] = None,
) -> None:
    result = await db.execute(
        select(ReconstructionJob)
        .where(ReconstructionJob.project_id == project_id)
        .options(selectinload(ReconstructionJob.stages))
        .order_by(ReconstructionJob.id.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if not job:
        return
    for stage in job.stages:
        if stage.stage_id == stage_id:
            if status is not None:
                stage.status = status.value
            if progress is not None:
                stage.progress = progress
            if stats is not None:
                current = stage.stats or {}
                current.update(stats)
                stage.stats = current
            if error is not None:
                stage.error = error
                stage.status = StageStatus.ERROR.value
            break
    await db.commit()


async def mark_splat_ready(db: AsyncSession, project_id: str) -> None:
    result = await db.execute(
        select(ReconstructionJob)
        .where(ReconstructionJob.project_id == project_id)
        .order_by(ReconstructionJob.id.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if job:
        job.splat_ready = True
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()


# --- Sync wrappers for background thread usage (colmap, gaussian splatting) ---


def update_stage_sync(
    project_id: str,
    stage_id: str,
    *,
    status: Optional[StageStatus] = None,
    progress: Optional[int] = None,
    stats: Optional[dict[str, str]] = None,
    error: Optional[str] = None,
) -> None:
    with Session(_sync_engine) as session:
        result = session.execute(
            select(ReconstructionJob)
            .where(ReconstructionJob.project_id == project_id)
            .options(selectinload(ReconstructionJob.stages))
            .order_by(ReconstructionJob.id.desc())
            .limit(1)
        )
        job = result.scalar_one_or_none()
        if not job:
            return
        for stage in job.stages:
            if stage.stage_id == stage_id:
                if status is not None:
                    stage.status = status.value
                if progress is not None:
                    stage.progress = progress
                if stats is not None:
                    current = stage.stats or {}
                    current.update(stats)
                    stage.stats = current
                if error is not None:
                    stage.error = error
                    stage.status = StageStatus.ERROR.value
                break
        session.commit()


def mark_splat_ready_sync(project_id: str) -> None:
    with Session(_sync_engine) as session:
        result = session.execute(
            select(ReconstructionJob)
            .where(ReconstructionJob.project_id == project_id)
            .order_by(ReconstructionJob.id.desc())
            .limit(1)
        )
        job = result.scalar_one_or_none()
        if job:
            job.splat_ready = True
            job.completed_at = datetime.now(timezone.utc)
            session.commit()
