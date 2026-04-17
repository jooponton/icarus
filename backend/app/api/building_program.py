"""Building program endpoint.

Stage 1 of the max-quality pipeline: takes a BuildingSpec and returns a
fully decomposed BuildingProgram — the hierarchical architectural tree
that drives procedural geometry generation.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.building_program import BuildingProgram
from app.schemas.project import BuildingSpec
from app.services.ai.building_program import generate_building_program

logger = logging.getLogger(__name__)

router = APIRouter(tags=["building-program"])


class ProgramRequest(BaseModel):
    spec: BuildingSpec


class ProgramResponse(BaseModel):
    program: BuildingProgram


@router.post("/building/program", response_model=ProgramResponse)
async def create_building_program(req: ProgramRequest) -> ProgramResponse:
    """Decompose a BuildingSpec into a full BuildingProgram."""
    try:
        program = await generate_building_program(req.spec)
    except RuntimeError as exc:
        logger.exception("Building program generation failed")
        raise HTTPException(503, f"Program generation failed: {exc}") from exc

    return ProgramResponse(program=program)
