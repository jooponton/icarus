"""Stage 1 — Architectural program decomposition.

Takes a flat BuildingSpec and decomposes it into a full BuildingProgram:
a hierarchical tree of masses, levels, bays, openings, roof planes, material
zones, and code compliance checks.

The decomposition is performed by Claude, which acts as an architectural
reasoner — not a chatbot.  It receives the spec as structured input and
returns a single JSON BuildingProgram.  No conversation, no follow-ups.

This is the bridge between the user-facing spec and the procedural geometry
engine (Stage 2).
"""

from __future__ import annotations

import json
import logging
from typing import Any

import anthropic

from app.core.config import settings
from app.schemas.building_program import BuildingProgram
from app.schemas.project import BuildingSpec

logger = logging.getLogger(__name__)

_MODEL = "claude-sonnet-4-6"

# ── Compliance rule tables ────────────────────────────────────────────
# These are fed to Claude as context so it can run checks against the spec.
# Based on IBC 2021 / IRC 2021 simplified tables.

_OCCUPANCY_MAP: dict[str, str] = {
    "residential": "R-3 (one- and two-family dwellings)",
    "commercial": "B (business)",
    "mixed-use": "M (mercantile) / R-2 (residential) mixed",
    "institutional": "A-3 (assembly) or I (institutional)",
    "industrial": "F-1 (moderate hazard factory)",
    "gas_station": "M (mercantile) / S-1 (moderate hazard storage)",
    "warehouse": "S-1 (moderate hazard storage)",
    "retail": "M (mercantile)",
}

_CONSTRUCTION_TYPE_MAP: dict[str, dict[str, str]] = {
    "wood": {
        "type": "Type V-B (wood frame, unprotected)",
        "max_stories": "3",
        "max_height_m": "12.2",
    },
    "brick": {
        "type": "Type III-B (ordinary masonry exterior, unprotected interior)",
        "max_stories": "5",
        "max_height_m": "16.8",
    },
    "stone": {
        "type": "Type III-A (ordinary masonry, protected interior)",
        "max_stories": "5",
        "max_height_m": "19.8",
    },
    "concrete": {
        "type": "Type II-A (non-combustible, protected)",
        "max_stories": "12",
        "max_height_m": "48.8",
    },
    "steel": {
        "type": "Type II-B (non-combustible, unprotected)",
        "max_stories": "12",
        "max_height_m": "48.8",
    },
    "glass": {
        "type": "Type II-B with curtain wall (non-combustible)",
        "max_stories": "12",
        "max_height_m": "48.8",
    },
}

_FLOOR_HEIGHT_RULES = """Floor-to-floor height rules (IBC / IRC simplified):
- Residential: min ceiling 2.44m (8ft), typical floor-to-floor 2.9-3.2m
- Commercial/office: min ceiling 2.74m (9ft), typical floor-to-floor 3.5-4.0m
- Retail ground floor: min ceiling 3.0m (10ft), typical floor-to-floor 3.8-4.5m
- Warehouse/industrial: min ceiling 4.3m (14ft) for storage, typical 5.0-7.0m
- Institutional: min ceiling 2.74m (9ft), typical 3.5-4.0m
- Parking levels: min 2.4m clear, typical floor-to-floor 3.0-3.3m"""

_WINDOW_RULES = """Window and opening rules (IRC / IBC simplified):
- Residential bedrooms require min 0.52m2 net clear egress opening, sill max 1.12m AFF
- Min natural light: glazed area >= 8% of floor area per room (IRC R303)
- Min ventilation: operable area >= 4% of floor area per room
- Commercial: window-to-wall ratio (WWR) typically 30-60% for office, 60-90% for retail ground
- ADA: doors min 0.91m (36in) clear width, max 11.3kg opening force
- Emergency egress: at least one operable window per sleeping room"""

_STRUCTURAL_RULES = """Structural span rules (simplified):
- Wood joist max clear span: ~6.0m (20ft) for 2x12 floor, ~4.9m (16ft) for 2x10
- Steel beam: virtually unlimited with proper sizing
- Concrete slab: post-tensioned up to ~12m clear span; conventional ~9m
- Bearing wall spacing: wood frame typically 6-7m, masonry 8-10m
- If footprint width > max span for material, interior bearing walls or columns are required
- Column grid: commercial typically 6m, 7.5m, 9m, or 10.5m bays"""


def _material_key(material_text: str) -> str:
    """Extract the base material keyword from freeform text."""
    lower = material_text.lower()
    for key in ("concrete", "steel", "glass", "brick", "stone", "wood", "cedar",
                "timber", "lumber", "corten"):
        if key in lower:
            if key in ("cedar", "timber", "lumber"):
                return "wood"
            if key == "corten":
                return "steel"
            return key
    return "wood"  # conservative default


def _build_compliance_context(spec: BuildingSpec) -> str:
    """Build the compliance rule context block for the system prompt."""
    mat = _material_key(spec.material)
    ct = _CONSTRUCTION_TYPE_MAP.get(mat, _CONSTRUCTION_TYPE_MAP["wood"])
    occ = _OCCUPANCY_MAP.get(spec.building_type.lower(), "B (business)")

    return f"""COMPLIANCE CONTEXT (use these for the compliance checks):

Assumed jurisdiction: IBC 2021 / IRC 2021 (generic, no local amendments)
Occupancy classification: {occ}
Construction type: {ct["type"]}
Max allowable stories (IBC Table 504.3): {ct["max_stories"]}
Max allowable height (IBC Table 504.4): {ct["max_height_m"]} meters
Primary structural material: {mat}

{_FLOOR_HEIGHT_RULES}

{_WINDOW_RULES}

{_STRUCTURAL_RULES}"""


SYSTEM_PROMPT = """\
You are an architectural program decomposer.  You receive a BuildingSpec (a flat \
description of a building) and you return a BuildingProgram (a hierarchical \
decomposition into masses, levels, bays, openings, roof planes, material zones, \
and compliance checks).

Your job is to reason like a licensed architect doing schematic design:
1. Interpret the spec's building_type, style, stories, footprint, material, and roof.
2. Decide the mass strategy: one block for simple rectangles, two masses for L-shapes.
3. For each mass, design every level: floor-to-floor height, ceiling height, use, and \
   the bay rhythm on each facade (front/left/right/rear).
4. For each bay, place openings (windows, doors, storefronts) with real dimensions \
   that respect the style and code.
5. Design the roof: planes, pitches, overhangs, materials.
6. Assign material zones: give each distinct surface a zone_id and rich description.
7. Run compliance checks against the provided code context.

RULES:
- All dimensions in meters.
- Ground floor index = 0.
- Every level MUST have at least one bay on the front facade.
- Entrance bays (is_entrance=true) must have a door opening.
- Residential buildings: main entry door min 0.91m wide, windows appropriate to style.
- Commercial ground floors: taller floor-to-floor, larger glazing.
- Bay widths across a facade must sum to approximately the mass width (within 5%).
- Total height = sum of floor-to-floor heights + roof ridge height above top floor.
- Compliance checks: run every check listed in the compliance context.  Use "pass", \
  "warn", or "fail" status.  Count totals accurately.

OUTPUT: a single JSON object conforming to the BuildingProgram schema.  No prose, \
no markdown fences, no explanation outside the JSON.  The "reasoning" field inside \
the JSON is where you explain your design decisions (2-5 sentences).

SCHEMA REFERENCE (follow exactly):
{schema}
"""


def _get_schema_ref() -> str:
    """Generate a compact schema reference from the Pydantic model."""
    schema = BuildingProgram.model_json_schema()
    return json.dumps(schema, indent=2)


def _build_user_message(spec: BuildingSpec, compliance_ctx: str) -> str:
    spec_json = spec.model_dump_json(indent=2)
    return f"""Decompose this BuildingSpec into a full BuildingProgram.

BUILDING SPEC:
{spec_json}

{compliance_ctx}

Return the BuildingProgram JSON now."""


def _parse_program(text: str) -> BuildingProgram:
    """Parse the LLM response into a BuildingProgram.

    Handles both raw JSON and JSON wrapped in markdown fences.
    """
    cleaned = text.strip()

    if cleaned.startswith("```"):
        first_nl = cleaned.index("\n") + 1
        last_fence = cleaned.rfind("```")
        if last_fence > first_nl:
            cleaned = cleaned[first_nl:last_fence].strip()

    data = json.loads(cleaned)
    return BuildingProgram.model_validate(data)


def _post_process_compliance(program: BuildingProgram) -> BuildingProgram:
    """Recount compliance totals in case the LLM miscounted."""
    c = program.compliance
    c.passes = sum(1 for ch in c.checks if ch.status == "pass")
    c.warnings = sum(1 for ch in c.checks if ch.status == "warn")
    c.failures = sum(1 for ch in c.checks if ch.status == "fail")
    return program


def _validate_bay_widths(program: BuildingProgram) -> list[str]:
    """Check that bay widths per facade roughly sum to mass width/depth.
    Returns a list of warning strings (empty = all good)."""
    issues: list[str] = []
    for mass in program.masses:
        for level in mass.levels:
            for face, expected in [
                ("front", mass.width),
                ("rear", mass.width),
                ("left", mass.depth),
                ("right", mass.depth),
            ]:
                bays = getattr(level, f"{face}_bays", [])
                if not bays:
                    continue
                total = sum(b.width for b in bays)
                if abs(total - expected) / expected > 0.10:
                    issues.append(
                        f"{mass.label} L{level.index} {face}: bay widths sum to "
                        f"{total:.1f}m but expected ~{expected:.1f}m"
                    )
    return issues


async def generate_building_program(
    spec: BuildingSpec,
    *,
    max_retries: int = 2,
) -> BuildingProgram:
    """Decompose a BuildingSpec into a BuildingProgram via Claude.

    Retries on parse failure (the LLM occasionally wraps JSON in prose).
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    compliance_ctx = _build_compliance_context(spec)
    schema_ref = _get_schema_ref()
    system = SYSTEM_PROMPT.format(schema=schema_ref)
    user_msg = _build_user_message(spec, compliance_ctx)

    last_error: Exception | None = None

    for attempt in range(max_retries + 1):
        logger.info(
            "Generating building program (attempt %d/%d)",
            attempt + 1,
            max_retries + 1,
        )

        response = client.messages.create(
            model=_MODEL,
            max_tokens=8000,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = response.content[0].text

        try:
            program = _parse_program(raw)
            program = _post_process_compliance(program)

            bay_issues = _validate_bay_widths(program)
            if bay_issues:
                logger.warning(
                    "Bay width mismatches (non-blocking): %s",
                    "; ".join(bay_issues),
                )

            logger.info(
                "Building program generated: %d masses, %d levels total, "
                "%d compliance checks (%d pass / %d warn / %d fail)",
                len(program.masses),
                sum(len(m.levels) for m in program.masses),
                len(program.compliance.checks),
                program.compliance.passes,
                program.compliance.warnings,
                program.compliance.failures,
            )
            return program

        except (json.JSONDecodeError, ValueError) as exc:
            last_error = exc
            logger.warning(
                "Failed to parse building program (attempt %d): %s",
                attempt + 1,
                exc,
            )
            if attempt < max_retries:
                user_msg = (
                    f"Your previous response was not valid JSON.  Error: {exc}\n\n"
                    f"Return ONLY the BuildingProgram JSON, no prose, no markdown fences."
                )

    raise RuntimeError(
        f"Failed to generate building program after {max_retries + 1} attempts: "
        f"{last_error}"
    )
