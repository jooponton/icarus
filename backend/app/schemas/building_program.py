"""Hierarchical building program schema.

A BuildingProgram is a structured decomposition of a BuildingSpec into
an architectural tree: site → mass → levels → bays → openings → roof planes
→ material zones.  Every node carries real-world dimensions in meters.

This is the output of Stage 1 (LLM architectural reasoning) and the input
to Stage 2 (procedural geometry synthesis).
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Leaf nodes ────────────────────────────────────────────────────────

class Opening(BaseModel):
    """A single window or door within a bay."""

    type: Literal["window", "door", "garage_door", "storefront", "curtain_wall"]
    width: float = Field(..., gt=0, description="meters")
    height: float = Field(..., gt=0, description="meters")
    sill_height: float = Field(
        ..., ge=0,
        description="meters above finished floor to bottom of opening",
    )
    style: str = Field(
        default="standard",
        description="e.g. double-hung, casement, fixed, sliding, french",
    )
    count: int = Field(default=1, ge=1, description="repeated openings in this slot")
    notes: str = ""


class Bay(BaseModel):
    """A vertical slice of a facade.  Bays repeat to fill a wall."""

    label: str = Field(..., description="e.g. 'entrance bay', 'window bay A'")
    width: float = Field(..., gt=0, description="meters, center-to-center")
    openings: list[Opening] = Field(default_factory=list)
    is_entrance: bool = False
    notes: str = ""


# ── Level ─────────────────────────────────────────────────────────────

class Level(BaseModel):
    """One story of the building."""

    index: int = Field(..., ge=0, description="0 = ground floor")
    label: str = Field(default="", description="e.g. 'ground', 'mezzanine', 'penthouse'")
    floor_to_floor_height: float = Field(
        ..., gt=0,
        description="meters, slab-to-slab (includes structure depth)",
    )
    ceiling_height: float = Field(
        ..., gt=0,
        description="meters, finished floor to finished ceiling",
    )
    use: str = Field(
        default="",
        description="e.g. 'retail', 'office', 'residential', 'parking', 'lobby'",
    )
    front_bays: list[Bay] = Field(default_factory=list)
    left_bays: list[Bay] = Field(default_factory=list)
    right_bays: list[Bay] = Field(default_factory=list)
    rear_bays: list[Bay] = Field(default_factory=list)
    notes: str = ""


# ── Roof ──────────────────────────────────────────────────────────────

class RoofPlane(BaseModel):
    """One plane of the roof (a gable has 2, a hip has 4, flat has 1)."""

    label: str = Field(default="", description="e.g. 'front slope', 'rear slope'")
    pitch_deg: float = Field(
        ..., ge=0, le=90,
        description="degrees from horizontal (0 = flat)",
    )
    overhang: float = Field(
        default=0.0, ge=0,
        description="meters of eave overhang past the wall",
    )
    material: str = ""
    notes: str = ""


class Roof(BaseModel):
    style: Literal["flat", "gable", "hip", "mansard", "shed", "butterfly"]
    ridge_height_above_top_floor: float = Field(
        ..., gt=0,
        description="meters from top-floor slab to ridge apex",
    )
    planes: list[RoofPlane] = Field(default_factory=list)
    has_parapet: bool = False
    parapet_height: float = Field(default=0.0, ge=0, description="meters")
    notes: str = ""


# ── Mass / wing ───────────────────────────────────────────────────────

class Mass(BaseModel):
    """A single extruded volume.  Rectangular footprint only (L-shapes are
    two masses).  The building program decomposes complex footprints into
    multiple masses that join at shared walls."""

    label: str = Field(default="main", description="e.g. 'main block', 'wing'")
    width: float = Field(..., gt=0, description="meters, along front facade")
    depth: float = Field(..., gt=0, description="meters, front to back")
    origin_x: float = Field(
        default=0.0,
        description="meters, offset from site origin along X (right-positive)",
    )
    origin_z: float = Field(
        default=0.0,
        description="meters, offset from site origin along Z (front-positive)",
    )
    rotation_y: float = Field(
        default=0.0,
        description="degrees, clockwise rotation around Y-axis",
    )
    levels: list[Level] = Field(default_factory=list)
    roof: Roof
    foundation_depth: float = Field(
        default=0.6, gt=0,
        description="meters below grade to bottom of footing",
    )
    notes: str = ""


# ── Material zone ─────────────────────────────────────────────────────

class MaterialZone(BaseModel):
    """A named material assignment.  Geometry nodes reference these by zone_id."""

    zone_id: str = Field(..., description="e.g. 'wall_primary', 'roof_main', 'trim'")
    description: str = Field(
        ...,
        description="Rich material description for texture generation",
    )
    surfaces: list[str] = Field(
        default_factory=list,
        description="Which geometry surfaces use this zone, e.g. ['main.front', 'main.left']",
    )


# ── Compliance ────────────────────────────────────────────────────────

class ComplianceCheck(BaseModel):
    """One code/zoning compliance check result."""

    rule: str = Field(..., description="short rule name, e.g. 'max_building_height'")
    code_reference: str = Field(
        default="",
        description="e.g. 'IBC 504.3', 'IRC R301.2', 'zoning setback 25ft'",
    )
    status: Literal["pass", "warn", "fail"]
    value: str = Field(default="", description="computed value, e.g. '9.6m'")
    limit: str = Field(default="", description="code limit, e.g. '12.0m'")
    message: str = ""


class ComplianceReport(BaseModel):
    """Aggregated compliance results."""

    jurisdiction: str = Field(
        default="generic",
        description="Assumed code jurisdiction, e.g. 'IBC 2021', 'IRC 2021'",
    )
    occupancy_type: str = Field(
        default="",
        description="e.g. 'R-3 residential', 'B business', 'M mercantile'",
    )
    construction_type: str = Field(
        default="",
        description="e.g. 'Type V-B wood frame', 'Type II-B non-combustible'",
    )
    checks: list[ComplianceCheck] = Field(default_factory=list)
    passes: int = 0
    warnings: int = 0
    failures: int = 0


# ── Top-level program ─────────────────────────────────────────────────

class BuildingProgram(BaseModel):
    """The full hierarchical decomposition of a building spec.

    This is the canonical intermediate representation between the user-facing
    BuildingSpec and the procedural geometry engine.
    """

    version: int = Field(default=1, description="schema version for forward compat")
    summary: str = Field(
        ...,
        description="1-2 sentence architectural summary of the design intent",
    )
    total_height: float = Field(..., gt=0, description="meters, grade to ridge/parapet")
    total_floor_area: float = Field(..., gt=0, description="square meters, all levels")
    masses: list[Mass] = Field(..., min_length=1)
    material_zones: list[MaterialZone] = Field(default_factory=list)
    compliance: ComplianceReport = Field(default_factory=ComplianceReport)
    reasoning: str = Field(
        default="",
        description="LLM's architectural reasoning trace — why these choices",
    )
