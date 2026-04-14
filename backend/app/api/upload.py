import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Form, UploadFile, File
from supabase import AsyncClient

from app.core.config import settings
from app.core.supabase import get_supabase

router = APIRouter(tags=["upload"])


@router.post("/upload")
async def upload_footage(
    files: list[UploadFile] = File(...),
    project_id: Optional[str] = Form(None),
    sb: AsyncClient = Depends(get_supabase),
):
    if not project_id:
        project_id = str(uuid.uuid4())

    existing = (
        await sb.table("projects")
        .select("id")
        .eq("id", project_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        await sb.table("projects").insert({"id": project_id}).execute()

    project_dir = settings.upload_dir / project_id
    project_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        dest = project_dir / f.filename
        content = await f.read()
        dest.write_bytes(content)
        saved.append({
            "name": f.filename,
            "size": len(content),
            "path": str(dest),
            "content_type": f.content_type,
        })

    return {
        "project_id": project_id,
        "files": saved,
        "count": len(saved),
    }
