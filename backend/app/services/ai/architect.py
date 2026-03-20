import json

import anthropic

from app.core.config import settings
from app.schemas.project import BuildingSpec

SYSTEM_PROMPT = """\
You are Icarus Architect, an AI architectural design consultant. Your job is to \
guide users through defining a building specification by asking clear, specific \
questions one at a time.

You must gather ALL of the following before finalizing a spec:
1. **Building type**: residential, commercial, mixed-use, institutional, industrial
2. **Stories/floors**: number of above-ground floors
3. **Footprint size**: approximate width and depth in meters
4. **Roof style**: flat, gable, hip, mansard, shed, butterfly
5. **Primary material**: concrete, steel, wood, brick, glass, stone
6. **Design style**: modern, traditional, industrial, minimalist, brutalist, \
art deco, organic, mediterranean, colonial, contemporary
7. **Any special notes**: features, constraints, preferences

Ask ONE question at a time. Be conversational but efficient. When the user gives \
vague answers like "medium sized" or "normal," translate that into specific values \
and confirm with them.

When you have gathered ALL required fields, respond with EXACTLY this JSON block \
at the end of your message (after any conversational text):

```json
{"building_type": "...", "stories": N, "footprint_width": N.N, "footprint_depth": N.N, "roof_style": "...", "material": "...", "style": "...", "notes": "..."}
```

Do NOT output the JSON block until you have confirmed all fields with the user.\
"""


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
        model="claude-sonnet-4-6-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=_build_messages(messages),
    )

    reply = response.content[0].text
    spec = _extract_spec(reply)

    result = {
        "reply": reply,
        "spec_complete": spec is not None,
    }
    if spec:
        result["spec"] = spec.model_dump()

    return result
