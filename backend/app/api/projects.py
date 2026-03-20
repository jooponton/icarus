from fastapi import APIRouter

router = APIRouter(tags=["projects"])


@router.get("/projects")
async def list_projects():
    # TODO: back with database
    return {"projects": []}


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    # TODO: back with database
    return {"project_id": project_id, "status": "pending"}
