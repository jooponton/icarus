from app.schemas.project import BuildingSpec
from app.schemas.validation import ValidationMessage, ValidationResult

# Max stories by building type
BUILDING_TYPE_RULES: dict[str, dict] = {
    "residential": {
        "max_stories": 5,
        "min_footprint": 30,
        "allowed_roofs": {"flat", "gable", "hip", "mansard", "shed", "butterfly"},
    },
    "commercial": {
        "max_stories": 20,
        "min_footprint": 50,
        "allowed_roofs": {"flat", "gable", "hip", "shed"},
    },
    "mixed-use": {
        "max_stories": 15,
        "min_footprint": 40,
        "allowed_roofs": {"flat", "gable", "hip"},
    },
    "institutional": {
        "max_stories": 10,
        "min_footprint": 80,
        "allowed_roofs": {"flat", "gable", "hip", "mansard"},
    },
    "industrial": {
        "max_stories": 4,
        "min_footprint": 100,
        "allowed_roofs": {"flat", "shed", "gable"},
    },
}

# Max stories by material (per building type, with defaults)
MATERIAL_STORY_LIMITS: dict[str, dict[str, int]] = {
    "wood": {"residential": 3, "commercial": 2, "default": 2},
    "brick": {"residential": 5, "commercial": 6, "default": 5},
    "stone": {"residential": 4, "commercial": 4, "default": 4},
    "concrete": {"default": 20},
    "steel": {"default": 50},
    "glass": {"default": 30},
}


def validate_building_spec(spec: BuildingSpec) -> ValidationResult:
    errors: list[ValidationMessage] = []
    warnings: list[ValidationMessage] = []

    bt = spec.building_type.lower()
    material = spec.material.lower()
    roof = spec.roof_style.lower()

    # Validate positive dimensions first
    if spec.footprint_width <= 0 or spec.footprint_depth <= 0:
        errors.append(ValidationMessage(
            code="INVALID_DIMENSIONS",
            message="Footprint width and depth must be positive",
            field="footprint_width",
            severity="error",
        ))
        return ValidationResult(
            valid=False, errors=errors, warnings=warnings,
            scores={"structural_plausibility": 0, "proportion_score": 0, "material_compatibility": 0},
        )

    if spec.stories <= 0:
        errors.append(ValidationMessage(
            code="INVALID_STORIES",
            message="Building must have at least 1 story",
            field="stories",
            severity="error",
        ))
        return ValidationResult(
            valid=False, errors=errors, warnings=warnings,
            scores={"structural_plausibility": 0, "proportion_score": 0, "material_compatibility": 0},
        )

    footprint_area = spec.footprint_width * spec.footprint_depth
    aspect_ratio = spec.footprint_width / spec.footprint_depth
    total_height = spec.stories * 3.2
    max_dim = max(spec.footprint_width, spec.footprint_depth)
    height_ratio = total_height / max_dim

    rules = BUILDING_TYPE_RULES.get(bt)

    # ── Errors (blockers) ──

    if rules and spec.stories > rules["max_stories"]:
        errors.append(ValidationMessage(
            code="STORIES_EXCEED_MAX",
            message=f"{bt.title()} buildings typically have at most {rules['max_stories']} stories",
            field="stories",
            severity="error",
        ))

    mat_limits = MATERIAL_STORY_LIMITS.get(material, {})
    mat_max = mat_limits.get(bt, mat_limits.get("default", 999))
    if spec.stories > mat_max:
        errors.append(ValidationMessage(
            code="MATERIAL_STORY_INCOMPATIBLE",
            message=f"{material.title()} structures are limited to ~{mat_max} stories for {bt}",
            field="material",
            severity="error",
        ))

    if rules and footprint_area < rules["min_footprint"]:
        errors.append(ValidationMessage(
            code="FOOTPRINT_TOO_SMALL",
            message=f"{bt.title()} buildings need at least {rules['min_footprint']}m² footprint (got {footprint_area:.0f}m²)",
            field="footprint_width",
            severity="error",
        ))

    # ── Warnings (advisory) ──

    if aspect_ratio < 0.25 or aspect_ratio > 4.0:
        warnings.append(ValidationMessage(
            code="EXTREME_ASPECT_RATIO",
            message=f"Footprint aspect ratio {aspect_ratio:.1f} is unusual — building may look unrealistic",
            field="footprint_width",
            severity="warning",
        ))

    if rules and roof not in rules["allowed_roofs"]:
        warnings.append(ValidationMessage(
            code="ROOF_STYLE_UNUSUAL",
            message=f"{roof.title()} roof is uncommon for {bt} buildings",
            field="roof_style",
            severity="warning",
        ))

    if height_ratio < 0.5:
        warnings.append(ValidationMessage(
            code="BUILDING_TOO_SQUAT",
            message="Building proportions are very squat — may look unrealistic",
            field="stories",
            severity="warning",
        ))
    elif height_ratio > 6.0:
        warnings.append(ValidationMessage(
            code="BUILDING_TOO_THIN",
            message="Building proportions are very slender — structural concerns in real construction",
            field="stories",
            severity="warning",
        ))

    # ── Scores (0-100) ──

    structural_score = 100.0
    if errors:
        structural_score -= len(errors) * 30
    if warnings:
        structural_score -= len(warnings) * 10
    structural_score = max(0, min(100, structural_score))

    # Proportion score — how close to ideal 1.5-3.0 height ratio
    if 1.0 <= height_ratio <= 4.0:
        proportion_score = 95.0
    elif 0.5 <= height_ratio <= 6.0:
        proportion_score = 75.0
    else:
        proportion_score = 50.0

    # Material compatibility
    material_score = 100.0
    if any(e.code == "MATERIAL_STORY_INCOMPATIBLE" for e in errors):
        material_score = 30.0
    elif mat_max != 999 and spec.stories > mat_max * 0.8:
        material_score = 70.0

    scores = {
        "structural_plausibility": round(structural_score, 1),
        "proportion_score": round(proportion_score, 1),
        "material_compatibility": round(material_score, 1),
    }

    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        scores=scores,
    )
