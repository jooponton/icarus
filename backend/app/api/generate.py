from fastapi import APIRouter

from app.schemas.project import BuildingSpec
from app.schemas.validation import ValidationResult
from app.services.generation.validator import validate_building_spec

router = APIRouter(tags=["generate"])


@router.post("/generate/validate", response_model=ValidationResult)
async def validate_spec(spec: BuildingSpec):
    return validate_building_spec(spec)
