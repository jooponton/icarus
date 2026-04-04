from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class BuildingSpec(Base):
    __tablename__ = "building_specs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False
    )
    building_type: Mapped[str] = mapped_column(String(50), nullable=False)
    stories: Mapped[int] = mapped_column(Integer, nullable=False)
    footprint_width: Mapped[float] = mapped_column(Float, nullable=False)
    footprint_depth: Mapped[float] = mapped_column(Float, nullable=False)
    roof_style: Mapped[str] = mapped_column(String(50), nullable=False)
    material: Mapped[str] = mapped_column(String(50), nullable=False)
    style: Mapped[str] = mapped_column(String(100), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    project = relationship("Project", back_populates="building_specs")
