"""Pydantic schemas for plant-entry endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

ZONE_PATTERN = r"^(0-5|5-10|10-30|30-100)$"


class PlantEntryCreate(BaseModel):
    taxlot_id: str = Field(min_length=1, max_length=50)
    zone: str = Field(pattern=ZONE_PATTERN)
    plant_id: str | None = Field(default=None, max_length=100)
    plant_name: str = Field(min_length=1, max_length=100)
    notes: str | None = None


class PlantEntryUpdate(BaseModel):
    # Deliberately omits plant_id — re-identifying a free-text entry as an LWF
    # match is a V2 concern.
    zone: str | None = Field(default=None, pattern=ZONE_PATTERN)
    plant_name: str | None = Field(default=None, min_length=1, max_length=100)
    notes: str | None = None


class PlantEntryResponse(BaseModel):
    id: uuid.UUID
    taxlot_id: str
    zone: str
    plant_id: str | None
    plant_name: str
    source: str
    image_url: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
