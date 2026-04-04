from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.project import Project
from app.schemas.project import ProjectCreate

router = APIRouter(tags=["projects"])


@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project).order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    return {
        "projects": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
            for p in projects
        ]
    }


@router.get("/projects/{project_id}")
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.reconstruction_jobs),
            selectinload(Project.texture_jobs),
            selectinload(Project.building_specs),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, f"Project {project_id} not found")

    recon = project.reconstruction_jobs[-1] if project.reconstruction_jobs else None
    tex = project.texture_jobs[-1] if project.texture_jobs else None
    spec = project.building_specs[-1] if project.building_specs else None

    return {
        "project_id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "status": "splat_ready" if (recon and recon.splat_ready) else "pending",
        "has_spec": spec is not None,
        "has_textures": tex.textures_ready if tex else False,
    }


@router.post("/projects")
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    import uuid

    project = Project(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return {
        "project_id": project.id,
        "name": project.name,
        "description": project.description,
    }


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, f"Project {project_id} not found")
    await db.delete(project)
    await db.commit()
    return {"deleted": project_id}
