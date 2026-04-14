from __future__ import annotations

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel
from supabase import AsyncClient, Client

from app.core.supabase import get_supabase_sync

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

_STAGE_ORDER = {s.id: i for i, s in enumerate(DEFAULT_STAGES)}


def _parse_dt(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _rows_to_status(job_row: dict, stage_rows: list[dict]) -> TextureJobStatus:
    ordered = sorted(stage_rows, key=lambda r: _STAGE_ORDER.get(r["stage_id"], 999))
    return TextureJobStatus(
        project_id=job_row["project_id"],
        spec_hash=job_row["spec_hash"],
        stages=[
            TextureStageInfo(
                id=s["stage_id"],
                name=s["name"],
                status=StageStatus(s["status"]),
                progress=s["progress"],
                error=s.get("error"),
            )
            for s in ordered
        ],
        started_at=_parse_dt(job_row.get("started_at")),
        completed_at=_parse_dt(job_row.get("completed_at")),
        textures_ready=job_row["textures_ready"],
    )


async def _latest_job(sb: AsyncClient, project_id: str) -> Optional[dict]:
    resp = (
        await sb.table("texture_jobs")
        .select("*")
        .eq("project_id", project_id)
        .order("id", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


async def _fetch_stages(sb: AsyncClient, job_id: int) -> list[dict]:
    resp = (
        await sb.table("texture_stages")
        .select("*")
        .eq("job_id", job_id)
        .execute()
    )
    return resp.data


async def create_job(
    sb: AsyncClient, project_id: str, spec_hash: str
) -> TextureJobStatus:
    job_resp = (
        await sb.table("texture_jobs")
        .insert({
            "project_id": project_id,
            "spec_hash": spec_hash,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "textures_ready": False,
        })
        .execute()
    )
    job_row = job_resp.data[0]
    stage_rows = [
        {
            "job_id": job_row["id"],
            "stage_id": s.id,
            "name": s.name,
            "status": s.status.value,
            "progress": s.progress,
        }
        for s in DEFAULT_STAGES
    ]
    stages_resp = await sb.table("texture_stages").insert(stage_rows).execute()
    logger.info("Created texture job for project %s (hash: %s)", project_id, spec_hash)
    return _rows_to_status(job_row, stages_resp.data)


async def get_job(
    sb: AsyncClient, project_id: str
) -> Optional[TextureJobStatus]:
    job_row = await _latest_job(sb, project_id)
    if not job_row:
        return None
    stage_rows = await _fetch_stages(sb, job_row["id"])
    return _rows_to_status(job_row, stage_rows)


async def update_stage(
    sb: AsyncClient,
    project_id: str,
    stage_id: str,
    *,
    status: Optional[StageStatus] = None,
    progress: Optional[int] = None,
    error: Optional[str] = None,
) -> None:
    job_row = await _latest_job(sb, project_id)
    if not job_row:
        return
    stage_resp = (
        await sb.table("texture_stages")
        .select("*")
        .eq("job_id", job_row["id"])
        .eq("stage_id", stage_id)
        .limit(1)
        .execute()
    )
    if not stage_resp.data:
        return
    stage = stage_resp.data[0]
    patch: dict = {}
    if status is not None:
        patch["status"] = status.value
    if progress is not None:
        patch["progress"] = progress
    if error is not None:
        patch["error"] = error
        patch["status"] = StageStatus.ERROR.value
    if patch:
        await (
            sb.table("texture_stages")
            .update(patch)
            .eq("id", stage["id"])
            .execute()
        )


async def mark_textures_ready(sb: AsyncClient, project_id: str) -> None:
    job_row = await _latest_job(sb, project_id)
    if not job_row:
        return
    await (
        sb.table("texture_jobs")
        .update({
            "textures_ready": True,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", job_row["id"])
        .execute()
    )


# --- Sync wrappers for background task usage (texture_generator) ---


def _latest_job_sync(sb: Client, project_id: str) -> Optional[dict]:
    resp = (
        sb.table("texture_jobs")
        .select("*")
        .eq("project_id", project_id)
        .order("id", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def create_job_sync(project_id: str, spec_hash: str) -> TextureJobStatus:
    sb = get_supabase_sync()
    job_resp = (
        sb.table("texture_jobs")
        .insert({
            "project_id": project_id,
            "spec_hash": spec_hash,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "textures_ready": False,
        })
        .execute()
    )
    job_row = job_resp.data[0]
    stage_rows = [
        {
            "job_id": job_row["id"],
            "stage_id": s.id,
            "name": s.name,
            "status": s.status.value,
            "progress": s.progress,
        }
        for s in DEFAULT_STAGES
    ]
    stages_resp = sb.table("texture_stages").insert(stage_rows).execute()
    logger.info("Created texture job for project %s (hash: %s)", project_id, spec_hash)
    return _rows_to_status(job_row, stages_resp.data)


def get_job_sync(project_id: str) -> Optional[TextureJobStatus]:
    sb = get_supabase_sync()
    job_row = _latest_job_sync(sb, project_id)
    if not job_row:
        return None
    stage_resp = (
        sb.table("texture_stages")
        .select("*")
        .eq("job_id", job_row["id"])
        .execute()
    )
    return _rows_to_status(job_row, stage_resp.data)


def update_stage_sync(
    project_id: str,
    stage_id: str,
    *,
    status: Optional[StageStatus] = None,
    progress: Optional[int] = None,
    error: Optional[str] = None,
) -> None:
    sb = get_supabase_sync()
    job_row = _latest_job_sync(sb, project_id)
    if not job_row:
        return
    stage_resp = (
        sb.table("texture_stages")
        .select("*")
        .eq("job_id", job_row["id"])
        .eq("stage_id", stage_id)
        .limit(1)
        .execute()
    )
    if not stage_resp.data:
        return
    stage = stage_resp.data[0]
    patch: dict = {}
    if status is not None:
        patch["status"] = status.value
    if progress is not None:
        patch["progress"] = progress
    if error is not None:
        patch["error"] = error
        patch["status"] = StageStatus.ERROR.value
    if patch:
        (
            sb.table("texture_stages")
            .update(patch)
            .eq("id", stage["id"])
            .execute()
        )


def mark_textures_ready_sync(project_id: str) -> None:
    sb = get_supabase_sync()
    job_row = _latest_job_sync(sb, project_id)
    if not job_row:
        return
    (
        sb.table("texture_jobs")
        .update({
            "textures_ready": True,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", job_row["id"])
        .execute()
    )
