from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


class BuildingSpec(BaseModel):
    building_type: str  # residential, commercial, mixed-use
    stories: int
    footprint_width: float  # meters
    footprint_depth: float  # meters
    roof_style: str  # flat, gable, hip, mansard
    material: str  # concrete, steel, wood, brick
    style: str  # modern, traditional, industrial, etc.
    notes: str = ""


class PlacementParams(BaseModel):
    position: tuple[float, float, float]
    rotation_y: float = 0.0
    scale: float = 1.0
