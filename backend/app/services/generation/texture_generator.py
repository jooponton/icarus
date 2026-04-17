"""Per-surface PBR texture generation via Gemini 2.5 Flash Image.

For each surface (wall, roof, door, trim) we ask Gemini for a flat seamless
square albedo tile, edge-blend it for tiling, then synthesize the auxiliary
PBR maps (normal, roughness, AO) from the albedo with `pbr_derive`.

Gemini renders architectural materials dramatically better than local SDXL —
real mortar, real grain, real reflections — and runs in seconds with no GPU.
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import json
import logging
import time
from pathlib import Path

import numpy as np
from PIL import Image

from app.core.config import settings
from app.schemas.project import BuildingSpec
from app.services.generation.texture_job_manager import (
    StageStatus,
    create_job_sync as create_job,
    get_job_sync as get_job,
    mark_textures_ready_sync as mark_textures_ready,
    update_stage_sync as update_stage,
)
from app.services.generation.pbr_derive import derive_pbr_stack
from app.services.generation.texture_prompts import build_prompts

logger = logging.getLogger(__name__)

TEXTURE_PARTS = ["wall", "roof", "door", "trim"]
PBR_CHANNELS = ["albedo", "normal", "roughness", "ao"]


# ── Gemini client ──────────────────────────────────────────────────


def _get_gemini_client():
    from google import genai

    if settings.gcp_project_id:
        return genai.Client(
            vertexai=True,
            project=settings.gcp_project_id,
            location=settings.gcp_location,
        )
    if settings.gemini_api_key:
        return genai.Client(api_key=settings.gemini_api_key)
    raise RuntimeError(
        "No Gemini credentials: set GCP_PROJECT_ID (Vertex) or GEMINI_API_KEY (AI Studio)"
    )


def _call_gemini_image(prompt: str, max_retries: int = 4) -> bytes | None:
    """Call Gemini image-gen with retry. Returns None on final failure so the
    caller can decide whether to fall back to a flat tile."""
    from google.genai import types

    client = _get_gemini_client()
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=settings.texture_model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
            )
            for candidate in response.candidates or []:
                for part in candidate.content.parts or []:
                    inline = getattr(part, "inline_data", None)
                    if inline and inline.data:
                        return inline.data
            finish = (
                (response.candidates[0].finish_reason if response.candidates else None)
                or "no_image_part"
            )
            logger.warning(
                "Gemini returned no image (attempt %d/%d, finish=%s)",
                attempt + 1, max_retries, finish,
            )
            time.sleep(2**attempt)
            continue
        except Exception as exc:
            is_rate_limit = "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc)
            if attempt < max_retries - 1:
                wait = 2**attempt * (10 if is_rate_limit else 2)
                logger.warning("Gemini error, retry in %ds (%d/%d): %s",
                               wait, attempt + 1, max_retries, exc)
                time.sleep(wait)
                continue
            logger.exception("Gemini failed after %d attempts", max_retries)
            return None
    return None


# Fallback base tints by surface so a Gemini failure still gives us a plausible
# swatch rather than dropping the whole pipeline.
_FALLBACK_TINTS: dict[str, tuple[int, int, int]] = {
    "wall": (176, 168, 154),
    "roof": (102, 102, 102),
    "door": (58, 42, 26),
    "trim": (200, 195, 185),
}


def _flat_albedo(part_id: str) -> Image.Image:
    tint = _FALLBACK_TINTS.get(part_id, (180, 180, 180))
    return Image.new("RGB", (settings.texture_size, settings.texture_size), tint)


def _generate_albedo(prompt: str, part_id: str) -> Image.Image:
    """One Gemini call → square RGB albedo. Falls back to a flat tint if
    Gemini keeps failing, so the downstream pipeline always produces a tile."""
    data = _call_gemini_image(prompt)
    if data is None:
        logger.warning("Using flat-tint fallback for %s", part_id)
        return _flat_albedo(part_id)
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        logger.exception("Gemini returned un-decodable bytes for %s", part_id)
        return _flat_albedo(part_id)
    if img.size != (settings.texture_size, settings.texture_size):
        img = img.resize((settings.texture_size, settings.texture_size), Image.LANCZOS)
    return img


# ── Spec hashing & cache ───────────────────────────────────────────


def compute_spec_hash(spec: BuildingSpec) -> str:
    """Deterministic hash of fields that affect texture appearance."""
    surface = spec.surface_materials.model_dump() if spec.surface_materials else {}
    key_fields = {
        "material": spec.material,
        "style": spec.style,
        "building_type": spec.building_type,
        "roof_style": spec.roof_style,
        "surface": surface,
    }
    return hashlib.sha256(
        json.dumps(key_fields, sort_keys=True).encode()
    ).hexdigest()[:16]


def _get_texture_dir(project_id: str, spec_hash: str) -> Path:
    return settings.texture_dir / project_id / spec_hash


def _is_cached(project_id: str, spec_hash: str) -> bool:
    texture_dir = _get_texture_dir(project_id, spec_hash)
    if not texture_dir.exists():
        return False
    for part in TEXTURE_PARTS:
        for ch in PBR_CHANNELS:
            if not (texture_dir / f"{part}.{ch}.png").exists():
                return False
    return True


# ── Tiling ─────────────────────────────────────────────────────────


def _make_seamless(image: Image.Image, blend_width: int = 64) -> Image.Image:
    """Mirror-blend the edges so the tile doesn't seam when repeated."""
    arr = np.array(image, dtype=np.float32)
    h, w = arr.shape[:2]
    bw = min(blend_width, h // 4, w // 4)
    if bw < 4:
        return image

    flipped_h = np.flip(arr, axis=1)
    alpha = np.linspace(0, 1, bw).reshape(1, bw, 1)
    arr[:, :bw] = arr[:, :bw] * alpha + flipped_h[:, :bw] * (1 - alpha)
    arr[:, -bw:] = arr[:, -bw:] * np.flip(alpha, axis=1) + flipped_h[:, -bw:] * (1 - np.flip(alpha, axis=1))

    flipped_v = np.flip(arr, axis=0)
    alpha_v = np.linspace(0, 1, bw).reshape(bw, 1, 1)
    arr[:bw, :] = arr[:bw, :] * alpha_v + flipped_v[:bw, :] * (1 - alpha_v)
    arr[-bw:, :] = arr[-bw:, :] * np.flip(alpha_v, axis=0) + flipped_v[-bw:, :] * (1 - np.flip(alpha_v, axis=0))

    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


# ── Public entry point ────────────────────────────────────────────


async def generate_textures(project_id: str, spec: BuildingSpec) -> None:
    """Generate the full PBR stack for a spec. Runs as a background task."""
    spec_hash = compute_spec_hash(spec)
    texture_dir = _get_texture_dir(project_id, spec_hash)

    if _is_cached(project_id, spec_hash):
        job = get_job(project_id)
        if job and job.spec_hash == spec_hash and job.textures_ready:
            logger.info("Textures cached for %s/%s", project_id, spec_hash)
            return
        create_job(project_id, spec_hash)
        for part in TEXTURE_PARTS:
            update_stage(project_id, part, status=StageStatus.COMPLETED, progress=100)
        mark_textures_ready(project_id)
        return

    texture_dir.mkdir(parents=True, exist_ok=True)
    create_job(project_id, spec_hash)

    prompts = build_prompts(spec)
    loop = asyncio.get_event_loop()

    for part_id in TEXTURE_PARTS:
        update_stage(project_id, part_id, status=StageStatus.RUNNING, progress=0)
        try:
            prompt = prompts[part_id]
            update_stage(project_id, part_id, progress=20)

            albedo = await loop.run_in_executor(None, _generate_albedo, prompt, part_id)
            update_stage(project_id, part_id, progress=60)

            albedo = _make_seamless(albedo)
            update_stage(project_id, part_id, progress=75)

            pbr = await loop.run_in_executor(None, derive_pbr_stack, albedo)
            pbr.albedo.save(texture_dir / f"{part_id}.albedo.png", "PNG")
            pbr.normal.save(texture_dir / f"{part_id}.normal.png", "PNG")
            pbr.roughness.save(texture_dir / f"{part_id}.roughness.png", "PNG")
            pbr.ao.save(texture_dir / f"{part_id}.ao.png", "PNG")

            update_stage(project_id, part_id, status=StageStatus.COMPLETED, progress=100)
            logger.info("Generated %s PBR stack for %s", part_id, project_id)
        except Exception as e:
            logger.exception("Failed to generate %s texture", part_id)
            update_stage(project_id, part_id, error=str(e))
            for remaining in TEXTURE_PARTS[TEXTURE_PARTS.index(part_id) + 1:]:
                update_stage(project_id, remaining, error="Skipped due to earlier failure")
            return

    mark_textures_ready(project_id)
    logger.info("All textures ready for %s/%s", project_id, spec_hash)
