"""CRUD layer tests for plant_entries."""

import uuid

import pytest
from sqlalchemy import text

from app.crud import plant_entries as crud
from app.crud.plant_entries import (
    EntryNotFoundError,
    ZoneCapExceededError,
    ZONE_CAP,
)
from app.models import PlantEntry


@pytest.fixture
async def db(db_session):
    await db_session.execute(text("DELETE FROM plant_entries"))
    await db_session.commit()
    yield db_session


def _payload(**overrides):
    base = {
        "taxlot_id": "391E09BC 3200",
        "zone": "5-10",
        "plant_id": None,
        "plant_name": "Rosemary",
        "notes": None,
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_create_entry_populates_defaults(db):
    entry = await crud.create_entry(db, _payload())
    assert isinstance(entry.id, uuid.UUID)
    assert entry.source == "manual"
    assert entry.created_at is not None
    assert entry.deleted_at is None


@pytest.mark.asyncio
async def test_list_entries_excludes_soft_deleted_and_orders(db):
    a = await crud.create_entry(db, _payload(plant_name="A", zone="10-30"))
    b = await crud.create_entry(db, _payload(plant_name="B", zone="0-5"))
    c = await crud.create_entry(db, _payload(plant_name="C", zone="0-5"))
    await crud.delete_entry(db, b.id)

    entries = await crud.get_entries_by_taxlot(db, "391E09BC 3200")
    names = [e.plant_name for e in entries]
    assert names == ["C", "A"]
    assert all(e.deleted_at is None for e in entries)
    _ = a


@pytest.mark.asyncio
async def test_update_partial_and_move_zone(db):
    entry = await crud.create_entry(db, _payload(zone="5-10"))
    updated = await crud.update_entry(db, entry.id, {"zone": "30-100"})
    assert updated.zone == "30-100"
    assert updated.plant_name == "Rosemary"


@pytest.mark.asyncio
async def test_update_on_soft_deleted_raises(db):
    entry = await crud.create_entry(db, _payload())
    await crud.delete_entry(db, entry.id)
    with pytest.raises(EntryNotFoundError):
        await crud.update_entry(db, entry.id, {"plant_name": "Renamed"})


@pytest.mark.asyncio
async def test_update_on_missing_raises(db):
    with pytest.raises(EntryNotFoundError):
        await crud.update_entry(db, uuid.uuid4(), {"plant_name": "Anything"})


@pytest.mark.asyncio
async def test_delete_is_idempotent(db):
    entry = await crud.create_entry(db, _payload())
    await crud.delete_entry(db, entry.id)
    first = await db.get(PlantEntry, entry.id)
    first_deleted_at = first.deleted_at
    assert first_deleted_at is not None

    await crud.delete_entry(db, entry.id)
    await db.refresh(first)
    assert first.deleted_at == first_deleted_at


@pytest.mark.asyncio
async def test_delete_missing_raises(db):
    with pytest.raises(EntryNotFoundError):
        await crud.delete_entry(db, uuid.uuid4())


@pytest.mark.asyncio
async def test_zone_cap_enforced(db, monkeypatch):
    monkeypatch.setattr(crud, "ZONE_CAP", 3)

    for i in range(3):
        await crud.create_entry(db, _payload(plant_name=f"Plant{i}"))

    with pytest.raises(ZoneCapExceededError):
        await crud.create_entry(db, _payload(plant_name="OneTooMany"))


@pytest.mark.asyncio
async def test_soft_deleted_do_not_count_toward_cap(db, monkeypatch):
    monkeypatch.setattr(crud, "ZONE_CAP", 2)

    e1 = await crud.create_entry(db, _payload(plant_name="P1"))
    await crud.create_entry(db, _payload(plant_name="P2"))
    await crud.delete_entry(db, e1.id)

    added = await crud.create_entry(db, _payload(plant_name="P3"))
    assert added.plant_name == "P3"


@pytest.mark.asyncio
async def test_module_cap_is_100():
    assert ZONE_CAP == 100
