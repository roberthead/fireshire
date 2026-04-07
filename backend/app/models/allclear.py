"""AllClear data models — parcels, survey responses, progress tracking, and map results."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Parcel(Base):
    __tablename__ = "parcels"

    hash_code: Mapped[str] = mapped_column(String(16), primary_key=True)
    account: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # 'owner' or 'occupant'
    owner_name: Mapped[str | None] = mapped_column(Text)
    situs_address: Mapped[str | None] = mapped_column(Text, index=True)
    mailing_address: Mapped[str | None] = mapped_column(Text)
    acreage: Mapped[float | None] = mapped_column(Float)
    year_built: Mapped[int | None] = mapped_column(Integer)
    land_value: Mapped[int | None] = mapped_column(Integer)
    imp_value: Mapped[int | None] = mapped_column(Integer)
    prop_class: Mapped[str | None] = mapped_column(String(16))
    map_taxlot: Mapped[str | None] = mapped_column(String(32))
    subdivision: Mapped[str | None] = mapped_column(Text)
    build_code: Mapped[int | None] = mapped_column(Integer)
    comm_sqft: Mapped[int | None] = mapped_column(Integer)
    lot_depth: Mapped[int | None] = mapped_column(Integer)
    lot_width: Mapped[int | None] = mapped_column(Integer)
    evac_zone: Mapped[str | None] = mapped_column(String(32))
    evac_city: Mapped[str | None] = mapped_column(String(64))
    city: Mapped[str | None] = mapped_column(String(64))


class UserProgress(Base):
    __tablename__ = "user_progress"

    hash_code: Mapped[str] = mapped_column(
        String(16), ForeignKey("parcels.hash_code"), primary_key=True
    )
    survey_complete: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    map_complete: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hash_code: Mapped[str] = mapped_column(
        String(16), ForeignKey("parcels.hash_code"), nullable=False, index=True
    )
    responded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Contact
    respondent_name: Mapped[str | None] = mapped_column(Text)
    respondent_email: Mapped[str | None] = mapped_column(Text)
    respondent_phone: Mapped[str | None] = mapped_column(Text)

    # Fire preparedness
    defensible_space: Mapped[str | None] = mapped_column(String(16))
    ember_resistant_roof: Mapped[str | None] = mapped_column(String(16))
    vegetation_clearance: Mapped[str | None] = mapped_column(String(16))
    has_fire_plan: Mapped[str | None] = mapped_column(String(8))
    has_go_bag: Mapped[str | None] = mapped_column(String(16))
    water_source: Mapped[str | None] = mapped_column(Text)
    evacuation_route: Mapped[str | None] = mapped_column(Text)
    hoa_name: Mapped[str | None] = mapped_column(Text)

    # Interest in programs
    wants_assessment: Mapped[bool] = mapped_column(Boolean, default=False)
    wants_firewise: Mapped[bool] = mapped_column(Boolean, default=False)
    wants_newsletter: Mapped[bool] = mapped_column(Boolean, default=False)

    # Open-ended
    concerns: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class MapResult(Base):
    __tablename__ = "map_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hash_code: Mapped[str] = mapped_column(
        String(16), ForeignKey("parcels.hash_code"), nullable=False, index=True
    )
    zones_geojson: Mapped[dict | None] = mapped_column(JSONB)
    buildings_count: Mapped[int | None] = mapped_column(Integer)
    plants_saved: Mapped[dict | None] = mapped_column(JSONB)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


# Trigram index for fuzzy address search (requires pg_trgm extension)
Index("idx_parcels_situs_trgm", Parcel.situs_address, postgresql_using="gin",
      postgresql_ops={"situs_address": "gin_trgm_ops"})
