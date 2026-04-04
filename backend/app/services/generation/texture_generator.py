from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from pathlib import Path
from typing import Any

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
from app.services.generation.texture_prompts import build_prompts

logger = logging.getLogger(__name__)

TEXTURE_PARTS = ["wall", "roof", "door", "trim"]

# Lazy-loaded singleton pipeline
_pipeline: Any = None


def _get_pipeline():
    """Load the diffusion pipeline once and reuse."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    import torch
    from diffusers import AutoPipelineForText2Image

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32
    variant = "fp16" if device == "cuda" else None

    logger.info("Loading texture model %s on %s", settings.texture_model_id, device)

    kwargs: dict[str, Any] = {
        "torch_dtype": dtype,
    }
    if variant:
        kwargs["variant"] = variant

    _pipeline = AutoPipelineForText2Image.from_pretrained(
        settings.texture_model_id,
        **kwargs,
    ).to(device)

    logger.info("Texture model loaded")
    return _pipeline


def compute_spec_hash(spec: BuildingSpec) -> str:
    """Deterministic hash of spec fields that affect texture appearance."""
    key_fields = {
        "material": spec.material,
        "style": spec.style,
        "building_type": spec.building_type,
        "roof_style": spec.roof_style,
    }
    return hashlib.sha256(
        json.dumps(key_fields, sort_keys=True).encode()
    ).hexdigest()[:16]


def _get_texture_dir(project_id: str, spec_hash: str) -> Path:
    return settings.texture_dir / project_id / spec_hash


def _is_cached(project_id: str, spec_hash: str) -> bool:
    """Check if all texture PNGs already exist on disk."""
    texture_dir = _get_texture_dir(project_id, spec_hash)
    if not texture_dir.exists():
        return False
    return all((texture_dir / f"{part}.png").exists() for part in TEXTURE_PARTS)


def _generate_single_texture(positive: str, negative: str) -> Image.Image:
    """Generate a single texture image using the diffusion pipeline."""
    pipe = _get_pipeline()
    result = pipe(
        prompt=positive,
        negative_prompt=negative,
        num_inference_steps=settings.texture_inference_steps,
        guidance_scale=settings.texture_guidance_scale,
        width=settings.texture_size,
        height=settings.texture_size,
    )
    return result.images[0]


def _make_seamless(image: Image.Image, blend_width: int = 64) -> Image.Image:
    """Make a texture seamless by mirroring and blending edges."""
    arr = np.array(image, dtype=np.float32)
    h, w = arr.shape[:2]
    bw = min(blend_width, h // 4, w // 4)

    if bw < 4:
        return image

    # Create a horizontally tiled version
    flipped_h = np.flip(arr, axis=1)
    # Blend left edge
    alpha = np.linspace(0, 1, bw).reshape(1, bw, 1)
    arr[:, :bw] = arr[:, :bw] * alpha + flipped_h[:, :bw] * (1 - alpha)
    # Blend right edge
    arr[:, -bw:] = arr[:, -bw:] * np.flip(alpha, axis=1) + flipped_h[:, -bw:] * (1 - np.flip(alpha, axis=1))

    # Create a vertically tiled version
    flipped_v = np.flip(arr, axis=0)
    alpha_v = np.linspace(0, 1, bw).reshape(bw, 1, 1)
    arr[:bw, :] = arr[:bw, :] * alpha_v + flipped_v[:bw, :] * (1 - alpha_v)
    arr[-bw:, :] = arr[-bw:, :] * np.flip(alpha_v, axis=0) + flipped_v[-bw:, :] * (1 - np.flip(alpha_v, axis=0))

    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


async def generate_textures(project_id: str, spec: BuildingSpec) -> None:
    """Generate all texture parts for a building spec. Runs as a background task."""
    spec_hash = compute_spec_hash(spec)
    texture_dir = _get_texture_dir(project_id, spec_hash)

    # Cache hit — mark ready and return
    if _is_cached(project_id, spec_hash):
        job = get_job(project_id)
        if job and job.spec_hash == spec_hash and job.textures_ready:
            logger.info("Textures cached for %s/%s", project_id, spec_hash)
            return
        # Files exist but job doesn't — recreate job as complete
        new_job = create_job(project_id, spec_hash)
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
            positive, negative = prompts[part_id]
            update_stage(project_id, part_id, progress=25)

            image = await loop.run_in_executor(
                None, _generate_single_texture, positive, negative
            )
            update_stage(project_id, part_id, progress=75)

            image = _make_seamless(image)
            image.save(texture_dir / f"{part_id}.png", "PNG")

            update_stage(project_id, part_id, status=StageStatus.COMPLETED, progress=100)
            logger.info("Generated %s texture for %s", part_id, project_id)
        except Exception as e:
            logger.error("Failed to generate %s texture: %s", part_id, e)
            update_stage(project_id, part_id, error=str(e))
            # Mark remaining stages as error so frontend knows to stop polling
            for remaining in TEXTURE_PARTS[TEXTURE_PARTS.index(part_id) + 1:]:
                update_stage(project_id, remaining, error="Skipped due to earlier failure")
            return

    mark_textures_ready(project_id)
    logger.info("All textures ready for %s/%s", project_id, spec_hash)
