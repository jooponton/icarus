from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.services.reconstruction import run_reconstruction_pipeline
from app.services.reconstruction.job_manager import create_job, get_job

router = APIRouter(tags=["reconstruct"])


@router.post("/reconstruct/{project_id}")
async def start_reconstruction(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Start the reconstruction pipeline for a project."""
    project_dir = settings.upload_dir / project_id
    if not project_dir.exists():
        raise HTTPException(404, f"Project {project_id} not found")

    files = list(project_dir.iterdir())
    if not files:
        raise HTTPException(400, "No files uploaded for this project")

    # Check if already running
    existing = await get_job(db, project_id)
    if existing and not existing.completed_at and not any(
        s.status.value == "error" for s in existing.stages
    ):
        raise HTTPException(409, "Reconstruction already in progress")

    await create_job(db, project_id)
    background_tasks.add_task(run_reconstruction_pipeline, project_id)

    return {"status": "started", "project_id": project_id}


@router.get("/reconstruct/{project_id}/status")
async def get_reconstruction_status(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Poll reconstruction pipeline status."""
    job = await get_job(db, project_id)
    if not job:
        raise HTTPException(404, f"No reconstruction job for project {project_id}")

    return {
        "project_id": job.project_id,
        "stages": [
            {
                "id": s.id,
                "name": s.name,
                "status": s.status.value,
                "progress": s.progress,
                "stats": s.stats,
                "error": s.error,
            }
            for s in job.stages
        ],
        "splat_ready": job.splat_ready,
    }


@router.get("/reconstruct/{project_id}/splat")
async def get_splat(project_id: str):
    """Serve the .splat file for web viewing."""
    splat_path = settings.processed_dir / project_id / "splat.splat"
    if not splat_path.exists():
        raise HTTPException(404, "Splat file not ready")

    return FileResponse(
        path=str(splat_path),
        media_type="application/octet-stream",
        filename=f"{project_id}.splat",
    )
