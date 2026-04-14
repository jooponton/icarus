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

_STAGE_ORDER = {s.id: i for i, s in enumerate(DEFAULT_STAGES)}


def _parse_dt(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _rows_to_status(job_row: dict, stage_rows: list[dict]) -> JobStatus:
    ordered = sorted(stage_rows, key=lambda r: _STAGE_ORDER.get(r["stage_id"], 999))
    return JobStatus(
        project_id=job_row["project_id"],
        stages=[
            StageInfo(
                id=s["stage_id"],
                name=s["name"],
                status=StageStatus(s["status"]),
                progress=s["progress"],
                stats=s.get("stats") or {},
                error=s.get("error"),
            )
            for s in ordered
        ],
        started_at=_parse_dt(job_row.get("started_at")),
        completed_at=_parse_dt(job_row.get("completed_at")),
        splat_ready=job_row["splat_ready"],
    )


async def _latest_job(sb: AsyncClient, project_id: str) -> Optional[dict]:
    resp = (
        await sb.table("reconstruction_jobs")
        .select("*")
        .eq("project_id", project_id)
        .order("id", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


async def _fetch_stages(sb: AsyncClient, job_id: int) -> list[dict]:
    resp = (
        await sb.table("reconstruction_stages")
        .select("*")
        .eq("job_id", job_id)
        .execute()
    )
    return resp.data


async def create_job(sb: AsyncClient, project_id: str) -> JobStatus:
    job_resp = (
        await sb.table("reconstruction_jobs")
        .insert({
            "project_id": project_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "splat_ready": False,
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
            "stats": s.stats,
        }
        for s in DEFAULT_STAGES
    ]
    stages_resp = await sb.table("reconstruction_stages").insert(stage_rows).execute()
    logger.info("Created reconstruction job for project %s", project_id)
    return _rows_to_status(job_row, stages_resp.data)


async def get_job(sb: AsyncClient, project_id: str) -> Optional[JobStatus]:
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
    stats: Optional[dict[str, str]] = None,
    error: Optional[str] = None,
) -> None:
    job_row = await _latest_job(sb, project_id)
    if not job_row:
        return
    stage_resp = (
        await sb.table("reconstruction_stages")
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
    if stats is not None:
        merged = dict(stage.get("stats") or {})
        merged.update(stats)
        patch["stats"] = merged
    if error is not None:
        patch["error"] = error
        patch["status"] = StageStatus.ERROR.value
    if patch:
        await (
            sb.table("reconstruction_stages")
            .update(patch)
            .eq("id", stage["id"])
            .execute()
        )


async def mark_splat_ready(sb: AsyncClient, project_id: str) -> None:
    job_row = await _latest_job(sb, project_id)
    if not job_row:
        return
    await (
        sb.table("reconstruction_jobs")
        .update({
            "splat_ready": True,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", job_row["id"])
        .execute()
    )


# --- Sync wrappers for background thread usage (colmap, gaussian splatting) ---


def _latest_job_sync(sb: Client, project_id: str) -> Optional[dict]:
    resp = (
        sb.table("reconstruction_jobs")
        .select("*")
        .eq("project_id", project_id)
        .order("id", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def update_stage_sync(
    project_id: str,
    stage_id: str,
    *,
    status: Optional[StageStatus] = None,
    progress: Optional[int] = None,
    stats: Optional[dict[str, str]] = None,
    error: Optional[str] = None,
) -> None:
    sb = get_supabase_sync()
    job_row = _latest_job_sync(sb, project_id)
    if not job_row:
        return
    stage_resp = (
        sb.table("reconstruction_stages")
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
    if stats is not None:
        merged = dict(stage.get("stats") or {})
        merged.update(stats)
        patch["stats"] = merged
    if error is not None:
        patch["error"] = error
        patch["status"] = StageStatus.ERROR.value
    if patch:
        (
            sb.table("reconstruction_stages")
            .update(patch)
            .eq("id", stage["id"])
            .execute()
        )


def mark_splat_ready_sync(project_id: str) -> None:
    sb = get_supabase_sync()
    job_row = _latest_job_sync(sb, project_id)
    if not job_row:
        return
    (
        sb.table("reconstruction_jobs")
        .update({
            "splat_ready": True,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", job_row["id"])
        .execute()
    )
