from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from app.core.config import settings
from app.schemas.project import BuildingSpec
from app.schemas.validation import ValidationResult
from app.services.generation.texture_generator import (
    TEXTURE_PARTS,
    compute_spec_hash,
    generate_textures,
)
from app.services.generation.texture_job_manager import get_job
from app.services.generation.validator import validate_building_spec

router = APIRouter(tags=["generate"])


@router.post("/generate/validate", response_model=ValidationResult)
async def validate_spec(spec: BuildingSpec):
    return validate_building_spec(spec)


@router.post("/generate/textures/{project_id}")
async def start_texture_generation(
    project_id: str, spec: BuildingSpec, background_tasks: BackgroundTasks
):
    spec_hash = compute_spec_hash(spec)

    # Check if already running with a different hash
    existing = get_job(project_id)
    if (
        existing
        and existing.spec_hash != spec_hash
        and not existing.textures_ready
        and not any(s.status == "error" for s in existing.stages)
    ):
        raise HTTPException(409, "Texture generation already in progress with different spec")

    # Check if already cached
    if existing and existing.spec_hash == spec_hash and existing.textures_ready:
        return {"status": "cached", "spec_hash": spec_hash}

    background_tasks.add_task(generate_textures, project_id, spec)
    return {"status": "started", "spec_hash": spec_hash}


@router.get("/generate/textures/{project_id}/status")
async def texture_status(project_id: str):
    job = get_job(project_id)
    if not job:
        raise HTTPException(404, "No texture job found for this project")
    return job


@router.get("/generate/textures/{project_id}/{part_id}")
async def get_texture(project_id: str, part_id: str):
    if part_id not in TEXTURE_PARTS:
        raise HTTPException(400, f"Invalid part: {part_id}. Must be one of {TEXTURE_PARTS}")

    job = get_job(project_id)
    if not job:
        raise HTTPException(404, "No texture job found")

    texture_path = settings.texture_dir / project_id / job.spec_hash / f"{part_id}.png"
    if not texture_path.exists():
        raise HTTPException(404, f"Texture {part_id} not yet generated")

    return FileResponse(texture_path, media_type="image/png")
