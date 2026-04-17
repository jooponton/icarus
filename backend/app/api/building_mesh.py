"""Building mesh endpoint.

Calls the fal.ai-backed service to produce a GLB mesh for a building spec.
Meshes are cached on disk by spec_hash and served by filename.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.config import settings
from app.schemas.project import BuildingSpec
from app.services.ai import building_mesh

logger = logging.getLogger(__name__)

router = APIRouter(tags=["building-mesh"])


class MeshRequest(BaseModel):
    project_id: str
    spec: BuildingSpec
    photo_filename: str
    pitch_deg: float


class MeshResponse(BaseModel):
    url: str
    spec_hash: str
    cached: bool


@router.post("/building/mesh", response_model=MeshResponse)
async def generate_building_mesh(req: MeshRequest) -> MeshResponse:
    photo_path = settings.upload_dir / req.project_id / req.photo_filename
    if not photo_path.exists():
        raise HTTPException(404, f"scene photo not found: {req.photo_filename}")

    spec_dict = req.spec.model_dump()
    loop = asyncio.get_running_loop()

    try:
        result = await loop.run_in_executor(
            None,
            building_mesh.generate_mesh,
            req.project_id,
            spec_dict,
            photo_path,
            req.pitch_deg,
        )
    except RuntimeError as exc:
        logger.exception("Mesh generation failed")
        raise HTTPException(503, f"Mesh unavailable: {exc}") from exc

    return MeshResponse(
        url=result.url,
        spec_hash=result.spec_hash,
        cached=result.cached,
    )


@router.get("/building/mesh/{project_id}/{filename}")
async def get_building_mesh(project_id: str, filename: str):
    path: Path = settings.building_render_dir / project_id / "meshes" / filename
    if not path.exists():
        raise HTTPException(404, "mesh not found")
    return FileResponse(path, media_type="model/gltf-binary")
