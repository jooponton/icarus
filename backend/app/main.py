from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import upload, projects, architect

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


@app.get("/api/health")
async def health():
    return {"status": "ok"}
