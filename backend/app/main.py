from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import upload, projects, architect, reconstruct, generate, pose, building_render, building_mesh, building_program
from app.core.config import settings


app = FastAPI(title="Icarus", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(architect.router, prefix="/api")
app.include_router(reconstruct.router, prefix="/api")
app.include_router(generate.router, prefix="/api")
app.include_router(pose.router, prefix="/api")
app.include_router(building_render.router, prefix="/api")
app.include_router(building_mesh.router, prefix="/api")
app.include_router(building_program.router, prefix="/api")


# Serve uploaded files (images for background compositing)
app.mount("/api/uploads", StaticFiles(directory=str(settings.upload_dir)), name="uploads")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
