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


def build_prompts(spec: BuildingSpec) -> dict[str, tuple[str, str]]:
    """Convert a BuildingSpec into Stable Diffusion prompts for each texture part.

    Returns: {part_id: (positive_prompt, negative_prompt)}
    """
    material_desc = MATERIAL_DESCRIPTORS.get(
        spec.material.lower(), f"{spec.material} building material"
    )
    style_mod = STYLE_MODIFIERS.get(
        spec.style.lower(), "architectural surface"
    )
    roof_material = _get_roof_material(spec.roof_style, spec.material)
    door_material = DOOR_MATERIALS.get(
        spec.building_type.lower(), "solid door, paneled"
    )

    base_suffix = "photorealistic, even lighting, no shadows, square tile, high resolution"

    prompts: dict[str, tuple[str, str]] = {
        "wall": (
            f"seamless tileable texture of {material_desc}, {style_mod}, "
            f"architectural wall surface, {base_suffix}",
            NEGATIVE_PROMPT,
        ),
        "roof": (
            f"seamless tileable texture of {roof_material}, "
            f"roofing material, top-down view, {base_suffix}",
            NEGATIVE_PROMPT,
        ),
        "door": (
            f"seamless tileable texture of {door_material}, "
            f"{style_mod}, door surface, {base_suffix}",
            NEGATIVE_PROMPT,
        ),
        "trim": (
            f"seamless tileable texture of painted wood trim, "
            f"window frame moulding, {style_mod}, {base_suffix}",
            NEGATIVE_PROMPT,
        ),
    }

    return prompts
