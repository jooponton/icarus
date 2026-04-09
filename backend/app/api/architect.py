import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.building_spec import BuildingSpec as BuildingSpecModel
from app.models.project import Project
from app.services.ai.architect import chat_with_architect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["architect"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ArchitectRequest(BaseModel):
    project_id: str
    messages: list[ChatMessage]


@router.post("/architect/chat")
async def architect_chat(
    req: ArchitectRequest,
    db: AsyncSession = Depends(get_db),
):
    history = [{"role": m.role, "content": m.content} for m in req.messages]
    try:
        result = await chat_with_architect(history)
    except Exception as exc:
        logger.exception("Architect chat failed")
        raise HTTPException(503, f"Architect AI unavailable: {exc}") from exc

    # Persist building spec when the architect conversation completes
    if result.get("spec_complete") and result.get("spec"):
        spec = result["spec"]
        # Only save if the project exists
        proj = await db.execute(
            select(Project).where(Project.id == req.project_id)
        )
        if proj.scalar_one_or_none():
            db_spec = BuildingSpecModel(
                project_id=req.project_id,
                building_type=spec["building_type"],
                stories=spec["stories"],
                footprint_width=spec["footprint_width"],
                footprint_depth=spec["footprint_depth"],
                roof_style=spec["roof_style"],
                material=spec["material"],
                style=spec["style"],
                notes=spec.get("notes", ""),
                footprint_shape=spec.get("footprint_shape", "rectangular"),
                wing_width=spec.get("wing_width"),
                wing_depth=spec.get("wing_depth"),
            )
            db.add(db_spec)
            await db.commit()

    return result
