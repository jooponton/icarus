"""Building render endpoint.

Calls the Gemini-backed render service to produce a photorealistic PNG of the
building spec composited into the scene photo from a given yaw angle. Cached
renders are served directly from disk by filename.
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
from app.services.ai import building_render

logger = logging.getLogger(__name__)

router = APIRouter(tags=["building-render"])


class RenderRequest(BaseModel):
    project_id: str
    spec: BuildingSpec
    yaw_deg: float
    photo_filename: str
    pitch_deg: float


class RenderResponse(BaseModel):
    url: str
    yaw: int
    spec_hash: str
    cached: bool


@router.post("/building/render", response_model=RenderResponse)
async def render_building(req: RenderRequest) -> RenderResponse:
    photo_path = settings.upload_dir / req.project_id / req.photo_filename
    if not photo_path.exists():
        raise HTTPException(404, f"scene photo not found: {req.photo_filename}")

    spec_dict = req.spec.model_dump()
    loop = asyncio.get_running_loop()

    try:
        result = await loop.run_in_executor(
            None,
            building_render.render_building,
            req.project_id,
            spec_dict,
            req.yaw_deg,
            photo_path,
            req.pitch_deg,
        )
    except RuntimeError as exc:
        # Configuration / API-level failure bubbles up as 503 so the frontend
        # can fall back to the procedural mesh.
        logger.exception("Building render failed")
        raise HTTPException(503, f"Render unavailable: {exc}") from exc

    return RenderResponse(
        url=result.url,
        yaw=building_render.quantize_yaw(req.yaw_deg),
        spec_hash=building_render.spec_hash(spec_dict),
        cached=result.cached,
    )


@router.get("/building/render/{project_id}/{filename}")
async def get_building_render(project_id: str, filename: str):
    path: Path = settings.building_render_dir / project_id / "renders" / filename
    if not path.exists():
        raise HTTPException(404, "render not found")
    return FileResponse(path, media_type="image/png")
