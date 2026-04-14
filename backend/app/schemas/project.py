from typing import Literal, Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


class SurfaceMaterials(BaseModel):
    """Optional per-surface material overrides. Freeform descriptive text —
    e.g., "weathered cedar siding, horizontal planks, sun-bleached".
    Any slot left None falls back to BuildingSpec.material."""

    wall: Optional[str] = None
    roof: Optional[str] = None
    trim: Optional[str] = None
    door: Optional[str] = None


SITE_ITEM_TYPES = Literal[
    "gas_pump",
    "pump_canopy",
    "bollard",
    "light_pole",
    "parking_stripe",
    "curb",
    "dumpster",
    "hvac_unit",
    "tree",
    "bench",
    "trash_can",
    "sign_pole",
]


class SiteItem(BaseModel):
    """A piece of site infrastructure placed relative to the building origin."""

    type: SITE_ITEM_TYPES
    position: tuple[float, float, float] = (0.0, 0.0, 0.0)
    rotation_y: float = 0.0
    scale: float = 1.0
    label: str = ""


class BuildingSpec(BaseModel):
    building_type: str  # residential, commercial, mixed-use
    stories: int
    footprint_width: float  # meters
    footprint_depth: float  # meters
    roof_style: str  # flat, gable, hip, mansard
    material: str  # primary/default material — freeform text, e.g. "rusted corten steel"
    style: str  # modern, traditional, industrial, etc.
    notes: str = ""
    footprint_shape: Literal["rectangular", "l-shaped"] = "rectangular"
    wing_width: Optional[float] = None  # meters, for L-shaped
    wing_depth: Optional[float] = None  # meters, for L-shaped
    surface_materials: SurfaceMaterials = Field(default_factory=SurfaceMaterials)
    site_items: list[SiteItem] = Field(default_factory=list)


class PlacementParams(BaseModel):
    position: tuple[float, float, float]
    rotation_y: float = 0.0
    scale: float = 1.0
