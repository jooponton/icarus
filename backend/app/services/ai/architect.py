import json
import re

import anthropic

from app.core.config import settings
from app.schemas.project import BuildingSpec

SYSTEM_PROMPT = """\
You are Icarus Architect. Gather a building spec by asking ONE short question per turn.

Style rules (strict):
- No emojis. Ever.
- No preamble, no filler, no restating the user's answer.
- Plain text only. No markdown headers, no bullet lists, no bold.
- Keep replies under 25 words unless the user explicitly asks for more.
- Translate vague answers ("medium", "normal") into concrete numbers and confirm inline.

Fields to collect (ask in this order, skip ones already answered):
1. building_type: residential | commercial | mixed-use | institutional | industrial | gas_station | warehouse | retail
2. stories: integer
3. footprint_width, footprint_depth: meters
4. roof_style: flat | gable | hip | mansard | shed | butterfly
5. material: FREEFORM. Describe the primary material richly, e.g. "weathered red brick with mortar joints", "rusted corten steel panels", "polished travertine limestone". Not limited to keywords.
6. style: modern | traditional | industrial | minimalist | brutalist | art deco | organic | mediterranean | colonial | contemporary
7. notes: any special features or constraints

Optional richer fields (ask only if the user hints at variation):
- surface_materials: per-surface overrides {wall, roof, trim, door}. Each is freeform text. Only include ones that differ from the primary material.
- site_items: auxiliary structures around the building. Propose a default layout based on building_type without asking; the user can edit later. Allowed types:
  gas_pump, pump_canopy, bollard, light_pole, parking_stripe, curb, dumpster, hvac_unit, tree, bench, trash_can, sign_pole

Footprint shape defaults to rectangular. Only ask about l-shaped if the user brings it up; then also collect wing_width and wing_depth (both smaller than the main dimensions).

Default site layouts (emit these automatically without asking):
- gas_station: 4 gas_pump in a 2x2 grid centered in front of the building, 1 pump_canopy covering them, 4 bollard around the pumps, 2 light_pole at the canopy corners, 1 dumpster behind the building, 6 parking_stripe along one side.
- commercial / retail: 8 parking_stripe in a row in front, 2 light_pole, 1 dumpster behind, 2 tree flanking the entrance, 1 bench near the door.
- residential: 2 tree out front, 1 hvac_unit on the side, optional 1 bench.
- warehouse: 1 hvac_unit on the roof side, 2 bollard at the loading bay, 1 dumpster, 4 light_pole around the perimeter.
- institutional: 4 parking_stripe, 2 bench, 2 tree, 2 light_pole, 1 sign_pole at the entrance.
- industrial: 4 bollard, 2 hvac_unit, 1 dumpster, 2 light_pole.
- mixed-use: 6 parking_stripe, 2 tree, 1 bench, 1 trash_can.

Positions are meters relative to building origin. X = right, Z = toward camera (negative = in front). Keep items outside the building footprint.

When every required field is known, emit the JSON block below on its own line (no prose around it):

```json
{"building_type":"...","stories":N,"footprint_width":N.N,"footprint_depth":N.N,"footprint_shape":"rectangular","roof_style":"...","material":"...","style":"...","notes":"...","surface_materials":{"wall":null,"roof":null,"trim":null,"door":null},"site_items":[{"type":"gas_pump","position":[2.0,0.0,-6.0],"rotation_y":0.0,"scale":1.0,"label":"pump 1"}]}
```

For l-shaped, include "footprint_shape":"l-shaped","wing_width":N.N,"wing_depth":N.N.

surface_materials and site_items are optional — omit or use nulls/empty array when none apply. Always emit site_items for gas_station, commercial, retail, and warehouse types using the default layouts above.

Do not emit the JSON until every required field is confirmed.\
"""


_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F000-\U0001F02F"
    "\U0001F0A0-\U0001F0FF"
    "\U0001F100-\U0001F1FF"
    "\U0001F200-\U0001F2FF"
    "\U00002300-\U000023FF"
    "\U00002B00-\U00002BFF"
    "\U0000FE00-\U0000FE0F"
    "\U0001F900-\U0001F9FF"
    "]+",
    flags=re.UNICODE,
)


def _strip_emojis(text: str) -> str:
    return _EMOJI_RE.sub("", text)


def _build_messages(history: list[dict]) -> list[dict]:
    """Convert chat history to Claude API message format."""
    messages = []
    for msg in history:
        role = "user" if msg["role"] == "user" else "assistant"
        messages.append({"role": role, "content": msg["content"]})
    return messages


def _extract_spec(text: str) -> BuildingSpec | None:
    """Try to extract a BuildingSpec JSON from the assistant's response."""
    start = text.find("```json")
    if start == -1:
        return None
    start = text.index("\n", start) + 1
    end = text.find("```", start)
    if end == -1:
        return None
    try:
        data = json.loads(text[start:end])
        return BuildingSpec(**data)
    except (json.JSONDecodeError, ValueError):
        return None


async def chat_with_architect(messages: list[dict]) -> dict:
    """Send conversation to Claude and return reply + optional spec."""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=_build_messages(messages),
    )

    reply = _strip_emojis(response.content[0].text)
    spec = _extract_spec(reply)

    result = {
        "reply": reply,
        "spec_complete": spec is not None,
    }
    if spec:
        result["spec"] = spec.model_dump()

    return result
