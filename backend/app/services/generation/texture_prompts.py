"""Gemini 2.5 Flash Image prompts for per-surface PBR albedo tiles.

Returns a single prose prompt per surface — Gemini doesn't use negative prompts.
We lean hard on the framing ("flat orthographic top-down square tile, edge-to-edge
seamless, no perspective, no lighting") because Gemini will otherwise produce a
3D render of the material rather than a tileable swatch.
"""

from app.schemas.project import BuildingSpec

MATERIAL_DESCRIPTORS: dict[str, str] = {
    "concrete": "raw board-formed concrete with horizontal timber-grain impressions, slight aggregate flecks, soft cement grey",
    "brick": "running-bond red clay brick with crisp recessed mortar joints, individual brick variation, weathered patina",
    "glass": "blue-green tinted curtain-wall glass with thin black aluminum mullion grid, faint reflections",
    "steel": "brushed stainless steel panels with hairline directional grain, riveted seams between panels",
    "wood": "vertical cedar plank siding with visible grain, knots, warm natural tone, fine shadow lines between boards",
    "stone": "ashlar limestone masonry with tight tooled joints, subtle quarry striations, cream-grey tone",
}

STYLE_MODIFIERS: dict[str, str] = {
    "modern": "clean contemporary architecture, precise machined finish",
    "traditional": "classical heritage architecture with aged patina",
    "industrial": "warehouse utilitarian with weathered surface and mild oxidation",
    "minimalist": "ultra-clean uniform pristine surface",
    "brutalist": "raw monolithic concrete with board-formed timber-grain texture",
    "colonial": "colonial-era painted finish with subtle brush variation",
    "art deco": "art deco geometric ornament from the 1930s, decorative low-relief surface",
    "mediterranean": "mediterranean stucco in warm tones, hand-troweled plaster texture",
    "contemporary": "contemporary refined surface with crisp finish",
    "organic": "natural organic earthy texture",
}

ROOF_MATERIALS: dict[str, dict[str, str]] = {
    "gable": {
        "brick": "overlapping terracotta clay roof tiles in warm orange-red, individual tile variation",
        "wood": "weathered cedar wood shingles in staggered courses, silver-grey patina",
        "stone": "natural slate roof tiles in dark grey with size variation",
        "default": "asphalt architectural shingles in charcoal grey",
    },
    "hip": {
        "brick": "overlapping terracotta clay roof tiles, warm orange-red",
        "wood": "cedar shingles in staggered courses, natural grain",
        "default": "concrete roof tiles in neutral grey, flat profile",
    },
    "flat": {
        "default": "smooth bitumen roofing membrane in dark charcoal with subtle texture",
    },
    "shed": {
        "default": "standing-seam metal roofing in zinc grey, vertical seams",
    },
    "mansard": {
        "default": "natural slate roof tiles in dark charcoal, French mansard pattern",
    },
    "butterfly": {
        "default": "standing-seam metal roofing in zinc finish, vertical seams",
    },
}

DOOR_MATERIALS: dict[str, str] = {
    "residential": "solid stained oak door with raised panels, brass hardware",
    "commercial": "modern aluminum-framed glass commercial door",
    "industrial": "heavy gauge riveted steel industrial door, dark grey",
    "institutional": "heavy double wood doors with brass hardware, dark mahogany",
    "mixed-use": "aluminum-framed glass storefront door",
}


def _get_roof_material(roof_style: str, material: str) -> str:
    roof_map = ROOF_MATERIALS.get(roof_style.lower(), ROOF_MATERIALS["flat"])
    return roof_map.get(material.lower(), roof_map.get("default", "roofing material"))


def _expand_material(raw: str | None, fallback_material: str) -> str:
    """User-supplied material → rich descriptor. Freeform text is kept verbatim."""
    if raw and raw.strip():
        key = raw.strip().lower()
        if key in MATERIAL_DESCRIPTORS:
            return MATERIAL_DESCRIPTORS[key]
        return raw.strip()
    return MATERIAL_DESCRIPTORS.get(
        fallback_material.lower(), fallback_material or "architectural surface"
    )


_FRAMING = (
    "Flat top-down orthographic square tile, edge-to-edge seamlessly tileable, "
    "even diffuse studio lighting with no shadows or highlights baked in, "
    "no perspective, no vanishing points, no curvature. The texture fills the "
    "entire frame and reads as a swatch a CG artist would use as an albedo map. "
    "No text, watermarks, people, vehicles, sky, ground, or border. "
    "Ultra-sharp focus, high resolution, photographic detail."
)


def _prompt(subject: str, style_mod: str) -> str:
    return (
        f"Photoreal seamless PBR albedo texture of {subject}. {style_mod}. "
        f"{_FRAMING}"
    )


def build_prompts(spec: BuildingSpec) -> dict[str, str]:
    """Per-surface Gemini prompts."""
    surface = spec.surface_materials
    wall_desc = _expand_material(surface.wall, spec.material)
    roof_desc = _expand_material(
        surface.roof,
        _get_roof_material(spec.roof_style, spec.material),
    )
    door_desc = _expand_material(
        surface.door,
        DOOR_MATERIALS.get(spec.building_type.lower(), "solid paneled door"),
    )
    trim_desc = _expand_material(
        surface.trim,
        "painted wood window-frame moulding in warm white",
    )

    style_mod = STYLE_MODIFIERS.get(spec.style.lower(), "architectural surface")

    return {
        "wall": _prompt(f"an architectural wall surface — {wall_desc}", style_mod),
        "roof": _prompt(f"a roofing surface — {roof_desc}", style_mod),
        "door": _prompt(f"a door surface — {door_desc}", style_mod),
        "trim": _prompt(f"architectural trim — {trim_desc}", style_mod),
    }
