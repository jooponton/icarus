from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TextureJob(Base):
    __tablename__ = "texture_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    spec_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    textures_ready: Mapped[bool] = mapped_column(Boolean, default=False)

    project = relationship("Project", back_populates="texture_jobs")
    stages = relationship(
        "TextureStage", back_populates="job", cascade="all, delete-orphan"
    )


class TextureStage(Base):
    __tablename__ = "texture_stages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("texture_jobs.id"), nullable=False
    )
    stage_id: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    job = relationship("TextureJob", back_populates="stages")
