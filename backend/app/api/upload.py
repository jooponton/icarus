import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Form, UploadFile, File

from app.core.config import settings

router = APIRouter(tags=["upload"])


@router.post("/upload")
async def upload_footage(
    files: list[UploadFile] = File(...),
    project_id: Optional[str] = Form(None),
):
    if not project_id:
        project_id = str(uuid.uuid4())
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
        })

    return {
        "project_id": project_id,
        "files": saved,
        "count": len(saved),
    }
