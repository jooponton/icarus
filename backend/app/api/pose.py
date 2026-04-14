"""Camera pose estimation endpoint.

Given an uploaded image, runs a monocular depth + ground plane pipeline to
recover the camera intrinsics/extrinsics and an anchor point on the ground.
The frontend uses this to match its three.js camera to the photo so generated
buildings stand on the correct ground plane.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.config import settings
from app.services.pose import CameraPose, estimate_from_image

router = APIRouter(tags=["pose"])


class PoseRequest(BaseModel):
    project_id: str
    filename: str


class PoseResponse(BaseModel):
    fov_deg: float
    width: int
    height: int
    pitch_deg: float
    roll_deg: float
    camera_height_m: float
    anchor: list[float]
    plane_normal: list[float]
    plane_d: float
    depth_map_url: str | None
    depth_min_m: float
    depth_max_m: float
    source: str


def _pose_to_response(pose: CameraPose) -> PoseResponse:
    return PoseResponse(
        fov_deg=pose.fov_deg,
        width=pose.width,
        height=pose.height,
        pitch_deg=pose.pitch_deg,
        roll_deg=pose.roll_deg,
        camera_height_m=pose.camera_height_m,
        anchor=list(pose.anchor),
        plane_normal=list(pose.plane_normal),
        plane_d=pose.plane_d,
        depth_map_url=pose.depth_map_url,
        depth_min_m=pose.depth_min_m,
        depth_max_m=pose.depth_max_m,
        source=pose.source,
    )


def _resolve_image(project_id: str, filename: str) -> Path:
    image_path = settings.upload_dir / project_id / filename
    if not image_path.exists():
        raise HTTPException(status_code=404, detail=f"image not found: {filename}")
    return image_path


@router.post("/pose/estimate", response_model=PoseResponse)
async def estimate_pose(req: PoseRequest) -> PoseResponse:
    image_path = _resolve_image(req.project_id, req.filename)
    out_dir = settings.processed_dir / req.project_id / "pose"

    # Reuse cached JSON if we've already estimated this image.
    cached_json = out_dir / f"{image_path.stem}.pose.json"
    if cached_json.exists():
        import json

        try:
            data = json.loads(cached_json.read_text())
            return PoseResponse(**{**data, "source": image_path.name})
        except Exception:
            # Corrupted cache — re-run.
            pass

    loop = asyncio.get_running_loop()
    pose: CameraPose = await loop.run_in_executor(
        None, estimate_from_image, image_path, out_dir
    )
    return _pose_to_response(pose)


@router.get("/pose/depth/{project_id}/{filename}")
async def get_depth_map(project_id: str, filename: str):
    path = settings.processed_dir / project_id / "pose" / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="depth map not found")
    return FileResponse(path, media_type="image/png")
