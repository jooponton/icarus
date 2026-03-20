from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["architect"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ArchitectRequest(BaseModel):
    project_id: str
    messages: list[ChatMessage]


@router.post("/architect/chat")
async def architect_chat(req: ArchitectRequest):
    # TODO: integrate Claude API for the architect questionnaire
    # This will guide users through building spec decisions:
    # - building type, size, stories
    # - design style, materials
    # - structural requirements
    # - site constraints from the reconstructed scene
    return {
        "reply": "Architect AI coming soon. What type of building are you envisioning?",
        "spec_complete": False,
    }
