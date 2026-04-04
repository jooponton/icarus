from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    reconstruction_jobs = relationship(
        "ReconstructionJob", back_populates="project", cascade="all, delete-orphan"
    )
    texture_jobs = relationship(
        "TextureJob", back_populates="project", cascade="all, delete-orphan"
    )
    building_specs = relationship(
        "BuildingSpec", back_populates="project", cascade="all, delete-orphan"
    )
