from fastapi import APIRouter
from pydantic import BaseModel

from app.services.ai.architect import chat_with_architect

router = APIRouter(tags=["architect"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ArchitectRequest(BaseModel):
    project_id: str
    messages: list[ChatMessage]


@router.post("/architect/chat")
async def architect_chat(req: ArchitectRequest):
    history = [{"role": m.role, "content": m.content} for m in req.messages]
    return await chat_with_architect(history)
