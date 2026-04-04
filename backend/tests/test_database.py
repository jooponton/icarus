import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.building_spec import BuildingSpec as BuildingSpecModel
from app.services.reconstruction.job_manager import (
    StageStatus,
    create_job as create_recon_job,
    get_job as get_recon_job,
    update_stage as update_recon_stage,
    mark_splat_ready,
)
from app.services.generation.texture_job_manager import (
    StageStatus as TexStageStatus,
    create_job as create_tex_job,
    get_job as get_tex_job,
    update_stage as update_tex_stage,
    mark_textures_ready,
)


@pytest.fixture
def project_id():
    return str(uuid.uuid4())


@pytest_asyncio.fixture
async def project_in_db(db_session: AsyncSession, project_id: str):
    project = Project(id=project_id, name="Test Project", description="test")
    db_session.add(project)
    await db_session.commit()
    return project


class TestProjectModel:
    @pytest.mark.asyncio
    async def test_create_project(self, db_session: AsyncSession, project_id: str):
        project = Project(id=project_id, name="My Project")
        db_session.add(project)
        await db_session.commit()

        result = await db_session.execute(
            select(Project).where(Project.id == project_id)
        )
        fetched = result.scalar_one()
        assert fetched.name == "My Project"
        assert fetched.created_at is not None

    @pytest.mark.asyncio
    async def test_project_defaults(self, db_session: AsyncSession):
        pid = str(uuid.uuid4())
        project = Project(id=pid)
        db_session.add(project)
        await db_session.commit()
        await db_session.refresh(project)

        assert project.name == ""
        assert project.description == ""


class TestReconstructionJobManager:
    @pytest.mark.asyncio
    async def test_create_and_get_job(
        self, db_session: AsyncSession, project_in_db: Project
    ):
        job = await create_recon_job(db_session, project_in_db.id)
        assert job.project_id == project_in_db.id
        assert len(job.stages) == 5
        assert job.stages[0].id == "frames"
        assert job.splat_ready is False

        fetched = await get_recon_job(db_session, project_in_db.id)
        assert fetched is not None
        assert fetched.project_id == project_in_db.id
        assert len(fetched.stages) == 5

    @pytest.mark.asyncio
    async def test_get_nonexistent_job(self, db_session: AsyncSession):
        result = await get_recon_job(db_session, "nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_update_stage(
        self, db_session: AsyncSession, project_in_db: Project
    ):
        await create_recon_job(db_session, project_in_db.id)
        await update_recon_stage(
            db_session,
            project_in_db.id,
            "frames",
            status=StageStatus.RUNNING,
            progress=50,
        )

        job = await get_recon_job(db_session, project_in_db.id)
        frames = next(s for s in job.stages if s.id == "frames")
        assert frames.status == StageStatus.RUNNING
        assert frames.progress == 50

    @pytest.mark.asyncio
    async def test_update_stage_error(
        self, db_session: AsyncSession, project_in_db: Project
    ):
        await create_recon_job(db_session, project_in_db.id)
        await update_recon_stage(
            db_session,
            project_in_db.id,
            "feature",
            error="Something broke",
        )

        job = await get_recon_job(db_session, project_in_db.id)
        feature = next(s for s in job.stages if s.id == "feature")
        assert feature.status == StageStatus.ERROR
        assert feature.error == "Something broke"

    @pytest.mark.asyncio
    async def test_mark_splat_ready(
        self, db_session: AsyncSession, project_in_db: Project
    ):
        await create_recon_job(db_session, project_in_db.id)
        await mark_splat_ready(db_session, project_in_db.id)

        job = await get_recon_job(db_session, project_in_db.id)
        assert job.splat_ready is True
        assert job.completed_at is not None


class TestTextureJobManager:
    @pytest.mark.asyncio
    async def test_create_and_get_job(
        self, db_session: AsyncSession, project_in_db: Project
    ):
        job = await create_tex_job(db_session, project_in_db.id, "abc123")
        assert job.project_id == project_in_db.id
        assert job.spec_hash == "abc123"
        assert len(job.stages) == 4
        assert job.textures_ready is False

        fetched = await get_tex_job(db_session, project_in_db.id)
        assert fetched is not None
        assert fetched.spec_hash == "abc123"

    @pytest.mark.asyncio
    async def test_update_stage(
        self, db_session: AsyncSession, project_in_db: Project
    ):
        await create_tex_job(db_session, project_in_db.id, "hash1")
        await update_tex_stage(
            db_session,
            project_in_db.id,
            "wall",
            status=TexStageStatus.COMPLETED,
            progress=100,
        )

        job = await get_tex_job(db_session, project_in_db.id)
        wall = next(s for s in job.stages if s.id == "wall")
        assert wall.status == TexStageStatus.COMPLETED
        assert wall.progress == 100

    @pytest.mark.asyncio
    async def test_mark_textures_ready(
        self, db_session: AsyncSession, project_in_db: Project
    ):
        await create_tex_job(db_session, project_in_db.id, "hash1")
        await mark_textures_ready(db_session, project_in_db.id)

        job = await get_tex_job(db_session, project_in_db.id)
        assert job.textures_ready is True
        assert job.completed_at is not None


class TestBuildingSpec:
    @pytest.mark.asyncio
    async def test_create_building_spec(
        self, db_session: AsyncSession, project_in_db: Project
    ):
        spec = BuildingSpecModel(
            project_id=project_in_db.id,
            building_type="residential",
            stories=2,
            footprint_width=12.0,
            footprint_depth=10.0,
            roof_style="gable",
            material="wood",
            style="modern",
            notes="test",
        )
        db_session.add(spec)
        await db_session.commit()

        result = await db_session.execute(
            select(BuildingSpecModel).where(
                BuildingSpecModel.project_id == project_in_db.id
            )
        )
        fetched = result.scalar_one()
        assert fetched.building_type == "residential"
        assert fetched.stories == 2


class TestProjectsAPI:
    @pytest.mark.asyncio
    async def test_list_projects_empty(self, client):
        resp = await client.get("/api/projects")
        assert resp.status_code == 200
        assert resp.json()["projects"] == []

    @pytest.mark.asyncio
    async def test_create_and_list_project(self, client):
        resp = await client.post(
            "/api/projects",
            json={"name": "Test Site", "description": "drone footage"},
        )
        assert resp.status_code == 200
        pid = resp.json()["project_id"]

        resp = await client.get("/api/projects")
        projects = resp.json()["projects"]
        assert len(projects) == 1
        assert projects[0]["id"] == pid
        assert projects[0]["name"] == "Test Site"

    @pytest.mark.asyncio
    async def test_get_project(self, client):
        resp = await client.post(
            "/api/projects", json={"name": "Detail Test"}
        )
        pid = resp.json()["project_id"]

        resp = await client.get(f"/api/projects/{pid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["project_id"] == pid
        assert data["status"] == "pending"

    @pytest.mark.asyncio
    async def test_get_nonexistent_project(self, client):
        resp = await client.get("/api/projects/nonexistent")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_project(self, client):
        resp = await client.post(
            "/api/projects", json={"name": "To Delete"}
        )
        pid = resp.json()["project_id"]

        resp = await client.delete(f"/api/projects/{pid}")
        assert resp.status_code == 200

        resp = await client.get(f"/api/projects/{pid}")
        assert resp.status_code == 404
