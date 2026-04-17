"""fal.ai-backed multi-view image-to-3D mesh service.

Pipeline:
  1. Render a photorealistic front view of the building with Gemini 2.5 Flash
     Image (hero 3/4 shot, clean studio background, no reference photo).
  2. Use that front view as an image reference to generate consistent back and
     left views (same building, different angle) — this is dramatically more
     stable than three independent generations.
  3. Feed all three views into `fal-ai/hunyuan3d/v2/multi-view` with textured
     mesh output and high octree resolution for sharp geometry.
  4. Cache the GLB on disk keyed by `spec_hash`.

Multi-view is the only path that preserves photographic quality in the final
mesh — single-image-to-3D is fundamentally lossy no matter the model.
"""

from __future__ import annotations

import io
import logging
import os
from dataclasses import dataclass
from pathlib import Path

import httpx
from PIL import Image

from app.core.config import settings
from app.services.ai.building_render import spec_hash

logger = logging.getLogger(__name__)

_GEMINI_MODEL = "gemini-2.5-flash-image"
_MESH_MODEL = "fal-ai/hunyuan3d/v2/multi-view"

# The three views Hunyuan3D multi-view expects.
_VIEWS = ("front", "back", "left")


@dataclass
class MeshResult:
    path: Path
    url: str
    cached: bool
    spec_hash: str


def _cache_path(project_id: str, shash: str) -> Path:
    return settings.building_render_dir / project_id / "meshes" / f"{shash}.glb"


def _input_image_path(project_id: str, shash: str, view: str) -> Path:
    return (
        settings.building_render_dir
        / project_id
        / "meshes"
        / f"{shash}_{view}.png"
    )


def _cache_url(project_id: str, shash: str) -> str:
    return f"/api/building/mesh/{project_id}/{shash}.glb"


def _base_spec_lines(spec: dict) -> str:
    notes = spec.get("notes") or ""
    btype = (spec.get("building_type") or "building").replace("_", " ")
    return f"""- Type: {btype}
- Stories: {spec.get("stories")}
- Footprint: approximately {spec.get("footprint_width")}m wide by {spec.get("footprint_depth")}m deep
- Roof style: {spec.get("roof_style")}
- Primary material: {spec.get("material")}
- Architectural style: {spec.get("style")}
- Notes: {notes}"""


_FRAMING_RULES = """Framing and background:
- Pure white background — no sky, no ground plane, no other buildings, no people, no vehicles, no shadows on the ground.
- Soft even lighting, realistic self-shadows on the building only.
- The entire building must be fully visible within the frame with a small margin on all sides. The building fills approximately 80% of the frame.
- Professional architectural photography: sharp focus, accurate materials, realistic glass reflections if applicable.
- No text, no watermarks, no UI overlays, no borders."""


def _front_prompt(spec: dict) -> str:
    btype = (spec.get("building_type") or "building").replace("_", " ")
    return f"""A high-quality photograph of a single {spec.get("style")} {btype} building, shot as a straight-on front elevation. The camera is centered on the building's front facade at eye level, perpendicular to the wall. Orthographic-looking — minimal perspective distortion.

Building specification:
{_base_spec_lines(spec)}

{_FRAMING_RULES}"""


def _view_prompt(view: str, spec: dict) -> str:
    btype = (spec.get("building_type") or "building").replace("_", " ")
    angle_desc = {
        "back": "a straight-on back elevation — the camera is directly behind the building at eye level, perpendicular to the rear wall",
        "left": "a straight-on left-side elevation — the camera is directly to the left of the building at eye level, perpendicular to the left wall",
    }[view]

    return f"""The same {spec.get("style")} {btype} building shown in the reference image, now photographed from {angle_desc}. Identical geometry, identical materials, identical proportions — only the camera angle changes.

Building specification (must match reference exactly):
{_base_spec_lines(spec)}

{_FRAMING_RULES}"""


def _call_gemini(prompt: str, reference: Image.Image | None) -> bytes:
    from google import genai
    from google.genai import types

    if settings.gcp_project_id:
        client = genai.Client(
            vertexai=True,
            project=settings.gcp_project_id,
            location=settings.gcp_location,
        )
    elif settings.gemini_api_key:
        client = genai.Client(api_key=settings.gemini_api_key)
    else:
        raise RuntimeError(
            "No Gemini credentials: set GCP_PROJECT_ID (Vertex) or GEMINI_API_KEY (AI Studio)"
        )

    contents: list = [prompt]
    if reference is not None:
        contents.append(reference)

    response = client.models.generate_content(
        model=_GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
    )

    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            inline = getattr(part, "inline_data", None)
            if inline and inline.data:
                return inline.data

    raise RuntimeError("Gemini returned no image")


def _render_views(project_id: str, spec: dict, shash: str) -> dict[str, Path]:
    """Render front/back/left views with Gemini. Back and left are conditioned
    on the front view for cross-angle consistency."""
    paths = {v: _input_image_path(project_id, shash, v) for v in _VIEWS}

    # Front first, unconditional.
    if not paths["front"].exists():
        logger.info("Rendering front view for spec_hash=%s", shash)
        data = _call_gemini(_front_prompt(spec), reference=None)
        paths["front"].parent.mkdir(parents=True, exist_ok=True)
        Image.open(io.BytesIO(data)).save(paths["front"], format="PNG")

    front_img = Image.open(paths["front"]).convert("RGB")

    for view in ("back", "left"):
        if paths[view].exists():
            continue
        logger.info("Rendering %s view for spec_hash=%s", view, shash)
        data = _call_gemini(_view_prompt(view, spec), reference=front_img)
        Image.open(io.BytesIO(data)).save(paths[view], format="PNG")

    return paths


def generate_mesh(
    project_id: str,
    spec: dict,
    photo_path: Path,  # unused; kept for API compatibility
    pitch_deg: float,  # unused; kept for API compatibility
) -> MeshResult:
    """Generate a GLB mesh for the building spec. Cached by spec hash."""
    shash = spec_hash(spec)
    out_path = _cache_path(project_id, shash)

    if out_path.exists():
        return MeshResult(
            path=out_path,
            url=_cache_url(project_id, shash),
            cached=True,
            spec_hash=shash,
        )

    if not settings.fal_api_key:
        raise RuntimeError("FAL_API_KEY not set — cannot generate mesh")

    view_paths = _render_views(project_id, spec, shash)

    import fal_client

    os.environ["FAL_KEY"] = settings.fal_api_key

    logger.info("Uploading %d views to fal", len(view_paths))
    urls = {v: fal_client.upload_file(str(p)) for v, p in view_paths.items()}

    logger.info("Submitting %s job for spec_hash=%s", _MESH_MODEL, shash)
    result = fal_client.subscribe(
        _MESH_MODEL,
        arguments={
            "front_image_url": urls["front"],
            "back_image_url": urls["back"],
            "left_image_url": urls["left"],
            "textured_mesh": True,
            "octree_resolution": 512,
        },
        with_logs=False,
    )

    mesh = result.get("model_mesh") if isinstance(result, dict) else None
    glb_url = mesh.get("url") if isinstance(mesh, dict) else None
    if not glb_url:
        raise RuntimeError(f"{_MESH_MODEL} returned no model_mesh: {result}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=240.0) as http:
        resp = http.get(glb_url)
        resp.raise_for_status()
        out_path.write_bytes(resp.content)

    logger.info("Saved GLB to %s (%d bytes)", out_path, out_path.stat().st_size)
    return MeshResult(
        path=out_path,
        url=_cache_url(project_id, shash),
        cached=False,
        spec_hash=shash,
    )
