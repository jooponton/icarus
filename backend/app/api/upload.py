import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Form, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.project import Project

router = APIRouter(tags=["upload"])


@router.post("/upload")
async def upload_footage(
    files: list[UploadFile] = File(...),
    project_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    if not project_id:
        project_id = str(uuid.uuid4())

    # Create project in DB if it doesn't exist
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        project = Project(id=project_id)
        db.add(project)
        await db.commit()

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
