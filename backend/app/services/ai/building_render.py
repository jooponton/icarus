"""Gemini-backed building render service.

Generates a photorealistic RGBA render of a building spec composited into the
user's uploaded scene photo from a specific yaw angle. Renders are cached on
disk keyed by `(spec_hash, yaw_deg)` so orbiting between previously-visited
angles is instant.

The "Nano Banana in 3D" approach: Gemini 2.5 Flash Image produces a perspective-
consistent render; the frontend puts the PNG on a camera-facing billboard at the
pose's ground anchor.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)

_MODEL_ID = "gemini-2.5-flash-image"

# Quantize yaw to 15° buckets so rotating slightly doesn't thrash the cache.
YAW_STEP_DEG = 15


def quantize_yaw(yaw_deg: float) -> int:
    """Normalize yaw to [0, 360) and snap to the nearest YAW_STEP_DEG bucket."""
    y = yaw_deg % 360.0
    bucket = int(round(y / YAW_STEP_DEG)) * YAW_STEP_DEG
    return bucket % 360


def spec_hash(spec: dict) -> str:
    """Stable hash over the canonical spec JSON — re-renders if any field changes."""
    canonical = json.dumps(spec, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


@dataclass
class RenderResult:
    path: Path
    url: str
    cached: bool


def _cache_path(project_id: str, shash: str, yaw: int) -> Path:
    return (
        settings.building_render_dir
        / project_id
        / "renders"
        / f"{shash}_y{yaw:03d}.png"
    )


def _cache_url(project_id: str, shash: str, yaw: int) -> str:
    return f"/api/building/render/{project_id}/{shash}_y{yaw:03d}.png"


def _describe_angle(yaw: int) -> str:
    """Human-readable camera angle for the prompt (yaw measured from front)."""
    buckets = [
        (0, "directly from the front"),
        (45, "from the front-right at a 45-degree angle"),
        (90, "from the right side"),
        (135, "from the back-right at a 45-degree angle"),
        (180, "directly from the back"),
        (225, "from the back-left at a 45-degree angle"),
        (270, "from the left side"),
        (315, "from the front-left at a 45-degree angle"),
    ]
    closest = min(buckets, key=lambda b: min(abs(yaw - b[0]), 360 - abs(yaw - b[0])))
    return closest[1]


def _build_prompt(spec: dict, yaw: int, pitch_deg: float) -> str:
    angle = _describe_angle(yaw)
    pitch_desc = (
        "looking down from above like a drone shot"
        if pitch_deg < -45
        else "at roughly eye level"
        if pitch_deg > -20
        else "from a slightly elevated angle"
    )
    notes = spec.get("notes") or ""
    return f"""Render a single photorealistic building, isolated on a solid pure magenta (#FF00FF) background. The building should be viewed {angle}, with the camera {pitch_desc}.

Use the attached reference photo ONLY as a lighting and style guide — match its sun direction, color temperature, shadow softness, and overall atmosphere. Do NOT copy or include any scenery, ground, sky, trees, or objects from the reference photo. The output must show ONLY the building itself.

Building specification:
- Type: {spec.get("building_type")}
- Stories: {spec.get("stories")}
- Footprint: {spec.get("footprint_width")}m wide by {spec.get("footprint_depth")}m deep
- Roof style: {spec.get("roof_style")}
- Primary material: {spec.get("material")}
- Architectural style: {spec.get("style")}
- Notes: {notes}

Hard requirements:
- Background: 100% uniform pure magenta (#FF00FF). No gradient, no texture, no sky, no ground.
- Foreground: the building only. No people, vehicles, fences, vegetation, or signage.
- NO cast shadow on the ground — the building should appear to float on the solid magenta background with no contact shadow or ground darkening. Self-shadows on the building itself are fine.
- Geometry must stay identical across different camera angles — same footprint and number of stories viewed from a different side.
- No text, watermarks, UI overlays, or borders."""


def _chroma_key(img: Image.Image, tolerance: int = 90) -> Image.Image:
    """Detect the background color from the image corners and key it out.

    Gemini reliably paints a solid color background when prompted but the
    color may drift (saturation, hue). We sample the four corners, use the
    median as the key, and zero out pixels within `tolerance` (sum of
    per-channel abs distance). This avoids hard-coding a specific RGB.
    """
    rgba = img.convert("RGBA")
    arr = np.array(rgba)
    h, w = arr.shape[:2]
    patch = 8
    corners = np.concatenate([
        arr[:patch, :patch, :3].reshape(-1, 3),
        arr[:patch, -patch:, :3].reshape(-1, 3),
        arr[-patch:, :patch, :3].reshape(-1, 3),
        arr[-patch:, -patch:, :3].reshape(-1, 3),
    ])
    key = np.median(corners, axis=0).astype(np.int16)

    rgb = arr[..., :3].astype(np.int16)
    dist = np.abs(rgb - key).sum(axis=-1)
    keep = dist > tolerance
    arr[..., 3] = np.where(keep, 255, 0).astype(np.uint8)
    return Image.fromarray(arr, mode="RGBA")


def render_building(
    project_id: str,
    spec: dict,
    yaw_deg: float,
    photo_path: Path,
    pitch_deg: float,
) -> RenderResult:
    """Render the building from a given yaw. Returns cached result if available."""
    yaw = quantize_yaw(yaw_deg)
    shash = spec_hash(spec)
    out_path = _cache_path(project_id, shash, yaw)

    if out_path.exists():
        return RenderResult(path=out_path, url=_cache_url(project_id, shash, yaw), cached=True)

    if not photo_path.exists():
        raise FileNotFoundError(f"scene photo not found: {photo_path}")

    # Lazy import so the backend still boots when google-genai isn't installed.
    from google import genai
    from google.genai import types

    # Prefer Vertex AI (billed via GCP) when a project is configured; fall back
    # to the AI Studio API key for local-only experimentation.
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

    scene = Image.open(photo_path).convert("RGB")
    # Gemini image input caps around 2048px on the long edge; resize to keep the
    # request small and deterministic.
    scene.thumbnail((2048, 2048))

    prompt = _build_prompt(spec, yaw, pitch_deg)

    try:
        response = client.models.generate_content(
            model=_MODEL_ID,
            contents=[prompt, scene],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            ),
        )
    except Exception:
        logger.exception("Gemini image render failed")
        raise

    # Extract the first image from the response parts.
    image_bytes: bytes | None = None
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            inline = getattr(part, "inline_data", None)
            if inline and inline.data:
                image_bytes = inline.data
                break
        if image_bytes:
            break

    if not image_bytes:
        raise RuntimeError("Gemini returned no image")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    raw = Image.open(io.BytesIO(image_bytes))
    keyed = _chroma_key(raw)
    keyed.save(out_path, format="PNG")

    return RenderResult(path=out_path, url=_cache_url(project_id, shash, yaw), cached=False)
