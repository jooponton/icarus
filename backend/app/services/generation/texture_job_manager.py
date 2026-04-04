from __future__ import annotations

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import create_engine, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, Session

from app.core.config import settings
from app.models.texture import TextureJob, TextureStage

logger = logging.getLogger(__name__)

_sync_url = settings.database_url.replace("sqlite+aiosqlite", "sqlite")
_sync_engine = create_engine(_sync_url)


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


def _job_to_status(job: TextureJob) -> TextureJobStatus:
    return TextureJobStatus(
        project_id=job.project_id,
        spec_hash=job.spec_hash,
        stages=[
            TextureStageInfo(
                id=s.stage_id,
                name=s.name,
                status=StageStatus(s.status),
                progress=s.progress,
                error=s.error,
            )
            for s in job.stages
        ],
        started_at=job.started_at,
        completed_at=job.completed_at,
        textures_ready=job.textures_ready,
    )


async def create_job(
    db: AsyncSession, project_id: str, spec_hash: str
) -> TextureJobStatus:
    job = TextureJob(
        project_id=project_id,
        spec_hash=spec_hash,
        started_at=datetime.now(timezone.utc),
    )
    for s in DEFAULT_STAGES:
        job.stages.append(
            TextureStage(
                stage_id=s.id,
                name=s.name,
                status=s.status.value,
                progress=s.progress,
            )
        )
    db.add(job)
    await db.commit()
    await db.refresh(job, ["stages"])
    logger.info("Created texture job for project %s (hash: %s)", project_id, spec_hash)
    return _job_to_status(job)


async def get_job(
    db: AsyncSession, project_id: str
) -> Optional[TextureJobStatus]:
    result = await db.execute(
        select(TextureJob)
        .where(TextureJob.project_id == project_id)
        .options(selectinload(TextureJob.stages))
        .order_by(TextureJob.id.desc())
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
    error: Optional[str] = None,
) -> None:
    result = await db.execute(
        select(TextureJob)
        .where(TextureJob.project_id == project_id)
        .options(selectinload(TextureJob.stages))
        .order_by(TextureJob.id.desc())
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
            if error is not None:
                stage.error = error
                stage.status = StageStatus.ERROR.value
            break
    await db.commit()


async def mark_textures_ready(db: AsyncSession, project_id: str) -> None:
    result = await db.execute(
        select(TextureJob)
        .where(TextureJob.project_id == project_id)
        .order_by(TextureJob.id.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if job:
        job.textures_ready = True
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()


# --- Sync wrappers for background task usage (texture_generator) ---


def create_job_sync(project_id: str, spec_hash: str) -> TextureJobStatus:
    with Session(_sync_engine) as session:
        job = TextureJob(
            project_id=project_id,
            spec_hash=spec_hash,
            started_at=datetime.now(timezone.utc),
        )
        for s in DEFAULT_STAGES:
            job.stages.append(
                TextureStage(
                    stage_id=s.id,
                    name=s.name,
                    status=s.status.value,
                    progress=s.progress,
                )
            )
        session.add(job)
        session.commit()
        session.refresh(job, ["stages"])
        logger.info("Created texture job for project %s (hash: %s)", project_id, spec_hash)
        return _job_to_status(job)


def get_job_sync(project_id: str) -> Optional[TextureJobStatus]:
    with Session(_sync_engine) as session:
        result = session.execute(
            select(TextureJob)
            .where(TextureJob.project_id == project_id)
            .options(selectinload(TextureJob.stages))
            .order_by(TextureJob.id.desc())
            .limit(1)
        )
        job = result.scalar_one_or_none()
        if not job:
            return None
        return _job_to_status(job)


def update_stage_sync(
    project_id: str,
    stage_id: str,
    *,
    status: Optional[StageStatus] = None,
    progress: Optional[int] = None,
    error: Optional[str] = None,
) -> None:
    with Session(_sync_engine) as session:
        result = session.execute(
            select(TextureJob)
            .where(TextureJob.project_id == project_id)
            .options(selectinload(TextureJob.stages))
            .order_by(TextureJob.id.desc())
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
                if error is not None:
                    stage.error = error
                    stage.status = StageStatus.ERROR.value
                break
        session.commit()


def mark_textures_ready_sync(project_id: str) -> None:
    with Session(_sync_engine) as session:
        result = session.execute(
            select(TextureJob)
            .where(TextureJob.project_id == project_id)
            .order_by(TextureJob.id.desc())
            .limit(1)
        )
        job = result.scalar_one_or_none()
        if job:
            job.textures_ready = True
            job.completed_at = datetime.now(timezone.utc)
            session.commit()
