import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import AsyncClient

from app.core.supabase import get_supabase
from app.services.ai.architect import chat_with_architect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["architect"])

# building_specs table has VARCHAR(50) columns; freeform fields (material,
# notes) must be truncated before insert or Postgres rejects the row.
_VARCHAR_CAP = 50


def _cap(value: str | None) -> str | None:
    if value is None:
        return None
    return value[:_VARCHAR_CAP]


class ChatMessage(BaseModel):
    role: str
    content: str


class ArchitectRequest(BaseModel):
    project_id: str
    messages: list[ChatMessage]


@router.post("/architect/chat")
async def architect_chat(
    req: ArchitectRequest,
    sb: AsyncClient = Depends(get_supabase),
):
    history = [{"role": m.role, "content": m.content} for m in req.messages]
    try:
        result = await chat_with_architect(history)
    except Exception as exc:
        logger.exception("Architect chat failed")
        raise HTTPException(503, f"Architect AI unavailable: {exc}") from exc

    if result.get("spec_complete") and result.get("spec"):
        spec = result["spec"]
        try:
            existing = (
                await sb.table("projects")
                .select("id")
                .eq("id", req.project_id)
                .limit(1)
                .execute()
            )
            if existing.data:
                await sb.table("building_specs").insert({
                    "project_id": req.project_id,
                    "building_type": _cap(spec["building_type"]),
                    "stories": spec["stories"],
                    "footprint_width": spec["footprint_width"],
                    "footprint_depth": spec["footprint_depth"],
                    "roof_style": _cap(spec["roof_style"]),
                    "material": _cap(spec["material"]),
                    "style": _cap(spec["style"]),
                    "notes": _cap(spec.get("notes", "")),
                    "footprint_shape": _cap(spec.get("footprint_shape", "rectangular")),
                    "wing_width": spec.get("wing_width"),
                    "wing_depth": spec.get("wing_depth"),
                }).execute()
        except Exception:
            # Persistence is best-effort — the spec still streams back to the
            # client so the user can keep designing even if the DB write fails.
            logger.exception("Failed to persist building spec")

    return result
