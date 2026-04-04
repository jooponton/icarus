from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ReconstructionJob(Base):
    __tablename__ = "reconstruction_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    splat_ready: Mapped[bool] = mapped_column(Boolean, default=False)

    project = relationship("Project", back_populates="reconstruction_jobs")
    stages = relationship(
        "ReconstructionStage", back_populates="job", cascade="all, delete-orphan"
    )


class ReconstructionStage(Base):
    __tablename__ = "reconstruction_stages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("reconstruction_jobs.id"), nullable=False
    )
    stage_id: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    stats: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    job = relationship("ReconstructionJob", back_populates="stages")
