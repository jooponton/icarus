from app.schemas.project import BuildingSpec

MATERIAL_DESCRIPTORS: dict[str, str] = {
    "concrete": "raw concrete, exposed aggregate, cement grey, brutalist surface",
    "brick": "red brick masonry, mortar joints, clay brick, running bond pattern",
    "glass": "blue-green tinted glass, reflective surface, curtain wall panels",
    "steel": "brushed steel panels, metallic sheen, corrugated steel cladding",
    "wood": "natural wood planks, timber grain, cedar siding, warm tones",
    "stone": "natural stone masonry, limestone blocks, quarried stone, rough hewn",
}

STYLE_MODIFIERS: dict[str, str] = {
    "modern": "clean minimal contemporary architecture, sleek finish",
    "traditional": "classical heritage architecture, aged patina",
    "industrial": "warehouse factory utilitarian, weathered surface",
    "minimalist": "ultra clean pristine surface, uniform finish",
    "brutalist": "raw concrete monolithic, board-formed texture",
    "colonial": "colonial era symmetrical heritage, painted finish",
    "art deco": "art deco geometric ornament 1930s, decorative surface",
    "mediterranean": "mediterranean stucco warm tones, textured plaster",
    "contemporary": "contemporary refined surface, precise finish",
    "organic": "natural organic flowing forms, earthy texture",
}

ROOF_MATERIALS: dict[str, dict[str, str]] = {
    "gable": {
        "brick": "terracotta clay roof tiles, overlapping",
        "wood": "cedar wood shingles, natural grain",
        "stone": "slate roof tiles, dark grey",
        "default": "asphalt shingles, charcoal grey",
    },
    "hip": {
        "brick": "terracotta clay roof tiles, overlapping",
        "wood": "cedar wood shingles, natural grain",
        "default": "concrete roof tiles, neutral grey",
    },
    "flat": {
        "default": "bitumen roofing membrane, dark grey, smooth",
    },
    "shed": {
        "default": "standing seam metal roofing, corrugated",
    },
    "mansard": {
        "default": "slate roof tiles, dark charcoal, French mansard",
    },
    "butterfly": {
        "default": "standing seam metal roofing, zinc finish",
    },
}

DOOR_MATERIALS: dict[str, str] = {
    "residential": "solid wood door, paneled, stained oak",
    "commercial": "glass and aluminum commercial door, modern entrance",
    "industrial": "steel industrial door, heavy gauge metal, riveted",
    "institutional": "heavy wooden double doors, brass hardware",
    "mixed-use": "glass storefront door, aluminum frame",
}

NEGATIVE_PROMPT = (
    "text, watermark, logo, humans, people, sky, perspective, "
    "3d render, gradient, uneven lighting, seams visible, blurry, "
    "low quality, cartoon, illustration, painting"
)


def _get_roof_material(roof_style: str, material: str) -> str:
    roof_map = ROOF_MATERIALS.get(roof_style.lower(), ROOF_MATERIALS["flat"])
    return roof_map.get(material.lower(), roof_map.get("default", "roofing material"))


def _expand_material(raw: str | None, fallback_key: str, fallback_material: str) -> str:
    """Turn a user-supplied material string into a rich SD prompt fragment.
    If the user gave freeform text, keep it verbatim and append surface hints.
    If they used a known keyword, look up the canonical descriptor."""
    if raw and raw.strip():
        key = raw.strip().lower()
        # Known keyword → canonical rich descriptor
        if key in MATERIAL_DESCRIPTORS:
            return MATERIAL_DESCRIPTORS[key]
        # Freeform — keep the user's words, let diffusion interpret them
        return raw.strip()
    # Fall back to the spec's primary material
    return MATERIAL_DESCRIPTORS.get(
        fallback_material.lower(), fallback_material or fallback_key
    )


def build_prompts(spec: BuildingSpec) -> dict[str, tuple[str, str]]:
    """Convert a BuildingSpec into Stable Diffusion prompts for each texture part.

    Per-surface overrides on `spec.surface_materials` win over the primary
    `spec.material`, and both accept freeform text ("weathered corten steel
    with rust patina") — not just the old six keywords.

    Returns: {part_id: (positive_prompt, negative_prompt)}
    """
    surface = spec.surface_materials
    wall_desc = _expand_material(surface.wall, "wall", spec.material)
    roof_desc = _expand_material(
        surface.roof,
        "roof",
        _get_roof_material(spec.roof_style, spec.material),
    )
    door_desc = _expand_material(
        surface.door,
        "door",
        DOOR_MATERIALS.get(spec.building_type.lower(), "solid door, paneled"),
    )
    trim_desc = _expand_material(surface.trim, "trim", "painted wood trim, window frame moulding")

    style_mod = STYLE_MODIFIERS.get(
        spec.style.lower(), "architectural surface"
    )

    base_suffix = (
        "photorealistic, even diffuse lighting, no shadows, no highlights, "
        "orthographic, square tile, high resolution, physically based material, "
        "surface detail visible"
    )

    prompts: dict[str, tuple[str, str]] = {
        "wall": (
            f"seamless tileable PBR texture of {wall_desc}, {style_mod}, "
            f"architectural wall surface, {base_suffix}",
            NEGATIVE_PROMPT,
        ),
        "roof": (
            f"seamless tileable PBR texture of {roof_desc}, "
            f"roofing material, top-down view, {base_suffix}",
            NEGATIVE_PROMPT,
        ),
        "door": (
            f"seamless tileable PBR texture of {door_desc}, "
            f"{style_mod}, door surface, {base_suffix}",
            NEGATIVE_PROMPT,
        ),
        "trim": (
            f"seamless tileable PBR texture of {trim_desc}, "
            f"{style_mod}, {base_suffix}",
            NEGATIVE_PROMPT,
        ),
    }

    return prompts
