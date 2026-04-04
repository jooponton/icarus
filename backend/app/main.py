from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import upload, projects, architect, reconstruct, generate
from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Icarus", version="0.1.0", lifespan=lifespan)

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


# Serve uploaded files (images for background compositing)
app.mount("/api/uploads", StaticFiles(directory=str(settings.upload_dir)), name="uploads")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
