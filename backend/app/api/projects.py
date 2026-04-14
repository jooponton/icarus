import uuid

from fastapi import APIRouter, Depends, HTTPException
from supabase import AsyncClient

from app.core.supabase import get_supabase
from app.schemas.project import ProjectCreate

router = APIRouter(tags=["projects"])


@router.get("/projects")
async def list_projects(sb: AsyncClient = Depends(get_supabase)):
    resp = (
        await sb.table("projects")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return {
        "projects": [
            {
                "id": p["id"],
                "name": p["name"],
                "description": p["description"],
                "created_at": p["created_at"],
                "updated_at": p["updated_at"],
            }
            for p in resp.data
        ]
    }


@router.get("/projects/{project_id}")
async def get_project(project_id: str, sb: AsyncClient = Depends(get_supabase)):
    proj_resp = (
        await sb.table("projects")
        .select("*")
        .eq("id", project_id)
        .limit(1)
        .execute()
    )
    if not proj_resp.data:
        raise HTTPException(404, f"Project {project_id} not found")
    project = proj_resp.data[0]

    recon_resp = (
        await sb.table("reconstruction_jobs")
        .select("*")
        .eq("project_id", project_id)
        .order("id", desc=True)
        .limit(1)
        .execute()
    )
    tex_resp = (
        await sb.table("texture_jobs")
        .select("*")
        .eq("project_id", project_id)
        .order("id", desc=True)
        .limit(1)
        .execute()
    )
    spec_resp = (
        await sb.table("building_specs")
        .select("*")
        .eq("project_id", project_id)
        .order("id", desc=True)
        .limit(1)
        .execute()
    )

    recon = recon_resp.data[0] if recon_resp.data else None
    tex = tex_resp.data[0] if tex_resp.data else None
    spec = spec_resp.data[0] if spec_resp.data else None

    return {
        "project_id": project["id"],
        "name": project["name"],
        "description": project["description"],
        "created_at": project["created_at"],
        "status": "splat_ready" if (recon and recon["splat_ready"]) else "pending",
        "has_spec": spec is not None,
        "spec": {
            "building_type": spec["building_type"],
            "stories": spec["stories"],
            "footprint_width": spec["footprint_width"],
            "footprint_depth": spec["footprint_depth"],
            "roof_style": spec["roof_style"],
            "material": spec["material"],
            "style": spec["style"],
            "notes": spec["notes"] or "",
            "footprint_shape": spec["footprint_shape"],
            "wing_width": spec["wing_width"],
            "wing_depth": spec["wing_depth"],
        } if spec else None,
        "has_textures": tex["textures_ready"] if tex else False,
    }


@router.post("/projects")
async def create_project(body: ProjectCreate, sb: AsyncClient = Depends(get_supabase)):
    pid = str(uuid.uuid4())
    resp = (
        await sb.table("projects")
        .insert({"id": pid, "name": body.name, "description": body.description})
        .execute()
    )
    row = resp.data[0]
    return {
        "project_id": row["id"],
        "name": row["name"],
        "description": row["description"],
    }


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, sb: AsyncClient = Depends(get_supabase)):
    resp = (
        await sb.table("projects")
        .delete()
        .eq("id", project_id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(404, f"Project {project_id} not found")
    return {"deleted": project_id}
