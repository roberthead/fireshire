"""CRUD operations for PlantEntry."""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PlantEntry


ZONE_CAP = 100


class EntryNotFoundError(Exception):
    """Raised when a plant entry is missing or soft-deleted."""


class ZoneCapExceededError(Exception):
    """Raised when creating an entry would exceed the per-zone cap."""

    def __init__(self, taxlot_id: str, zone: str, cap: int = ZONE_CAP):
        self.taxlot_id = taxlot_id
        self.zone = zone
        self.cap = cap
        super().__init__(
            f"Zone {zone} for taxlot {taxlot_id} already has {cap} entries"
        )


async def get_entries_by_taxlot(db: AsyncSession, taxlot_id: str) -> list[PlantEntry]:
    stmt = (
        select(PlantEntry)
        .where(PlantEntry.taxlot_id == taxlot_id, PlantEntry.deleted_at.is_(None))
        .order_by(PlantEntry.zone, PlantEntry.created_at)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _count_live_in_zone(db: AsyncSession, taxlot_id: str, zone: str) -> int:
    stmt = select(func.count()).select_from(PlantEntry).where(
        PlantEntry.taxlot_id == taxlot_id,
        PlantEntry.zone == zone,
        PlantEntry.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    return int(result.scalar_one())


async def create_entry(db: AsyncSession, data: dict[str, Any]) -> PlantEntry:
    count = await _count_live_in_zone(db, data["taxlot_id"], data["zone"])
    if count >= ZONE_CAP:
        raise ZoneCapExceededError(data["taxlot_id"], data["zone"])

    entry = PlantEntry(**data)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def _get_live(db: AsyncSession, entry_id: uuid.UUID) -> PlantEntry:
    entry = await db.get(PlantEntry, entry_id)
    if entry is None or entry.deleted_at is not None:
        raise EntryNotFoundError(str(entry_id))
    return entry


async def update_entry(
    db: AsyncSession, entry_id: uuid.UUID, data: dict[str, Any]
) -> PlantEntry:
    entry = await _get_live(db, entry_id)
    for field, value in data.items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return entry


async def delete_entry(db: AsyncSession, entry_id: uuid.UUID) -> None:
    entry = await db.get(PlantEntry, entry_id)
    if entry is None:
        raise EntryNotFoundError(str(entry_id))
    if entry.deleted_at is None:
        entry.deleted_at = datetime.now(timezone.utc)
        await db.commit()
