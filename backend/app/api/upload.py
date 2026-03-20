import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File

from app.core.config import settings

router = APIRouter(tags=["upload"])


@router.post("/upload")
async def upload_footage(files: list[UploadFile] = File(...)):
    project_id = str(uuid.uuid4())
    project_dir = settings.upload_dir / project_id
    project_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        dest = project_dir / f.filename
        content = await f.read()
        dest.write_bytes(content)
        saved.append(str(dest))

    return {
        "project_id": project_id,
        "files": saved,
        "count": len(saved),
    }
