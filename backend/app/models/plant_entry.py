"""PlantEntry — per-taxlot, per-zone plant inventory rows."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


ZONES = ("0-5", "5-10", "10-30", "30-100")
SOURCES = ("manual", "photo_id")


class PlantEntry(Base):
    __tablename__ = "plant_entries"

    # Duplicate entries are deliberately allowed — no unique constraint.
    __table_args__ = (
        CheckConstraint(
            "zone IN ('0-5', '5-10', '10-30', '30-100')",
            name="ck_plant_entries_zone",
        ),
        CheckConstraint(
            "source IN ('manual', 'photo_id')",
            name="ck_plant_entries_source",
        ),
        Index(
            "ix_plant_entries_taxlot_zone_live",
            "taxlot_id",
            "zone",
            postgresql_where="deleted_at IS NULL",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    taxlot_id: Mapped[str] = mapped_column(String(50), nullable=False)
    zone: Mapped[str] = mapped_column(String(20), nullable=False)
    plant_id: Mapped[str | None] = mapped_column(String(100))
    plant_name: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="manual", server_default="manual"
    )
    image_url: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default="now()",
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default="now()",
        nullable=False,
    )
