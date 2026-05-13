"""Integration tests for POST /allclear/parcels/resolve."""

import pytest
from sqlalchemy import select, text

from app.models import Parcel
from app.routers.allclear import _synthetic_hash_code


@pytest.fixture(autouse=True)
async def _reset_parcels(db_session):
    """Clear the parcels table (cascading children) for each test."""
    await db_session.execute(text("DELETE FROM map_results"))
    await db_session.execute(text("DELETE FROM survey_responses"))
    await db_session.execute(text("DELETE FROM user_progress"))
    await db_session.execute(text("DELETE FROM parcels"))
    await db_session.commit()
    yield


MAP_TAXLOT = "391E04AA1000"


def _payload(**overrides):
    base = {
        "map_taxlot": MAP_TAXLOT,
        "situs_address": "2770 DIANE ST",
        "owner_name": "DOE JANE",
        "acreage": 0.18,
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_resolve_creates_new_parcel(client, db_session):
    response = await client.post("/allclear/parcels/resolve", json=_payload())
    assert response.status_code == 200
    data = response.json()
    assert data["created"] is True
    assert data["hash_code"] == _synthetic_hash_code(MAP_TAXLOT)
    assert data["hash_code"].startswith("g")
    assert len(data["hash_code"]) == 16

    row = (await db_session.execute(
        select(Parcel).where(Parcel.hash_code == data["hash_code"])
    )).scalar_one()
    assert row.map_taxlot == MAP_TAXLOT
    assert row.role == "owner"
    assert row.situs_address == "2770 DIANE ST"
    assert row.city == "ASHLAND"


@pytest.mark.asyncio
async def test_resolve_returns_existing_parcel(client, db_session):
    db_session.add(Parcel(
        hash_code="seedhash00000001",
        account="ACCT-1",
        role="owner",
        map_taxlot=MAP_TAXLOT,
        situs_address="2770 DIANE ST",
    ))
    await db_session.commit()

    response = await client.post("/allclear/parcels/resolve", json=_payload())
    assert response.status_code == 200
    data = response.json()
    assert data["hash_code"] == "seedhash00000001"
    assert data["created"] is False

    # No new row was inserted.
    count = (await db_session.execute(
        select(Parcel).where(Parcel.map_taxlot == MAP_TAXLOT)
    )).scalars().all()
    assert len(count) == 1


@pytest.mark.asyncio
async def test_resolve_is_idempotent(client, db_session):
    first = await client.post("/allclear/parcels/resolve", json=_payload())
    second = await client.post("/allclear/parcels/resolve", json=_payload())
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["hash_code"] == second.json()["hash_code"]
    assert first.json()["created"] is True
    assert second.json()["created"] is False

    count = (await db_session.execute(
        select(Parcel).where(Parcel.map_taxlot == MAP_TAXLOT)
    )).scalars().all()
    assert len(count) == 1


@pytest.mark.asyncio
async def test_resolve_prefers_owner_over_occupant(client, db_session):
    db_session.add(Parcel(
        hash_code="occ0000000000001",
        account="ACCT-1",
        role="occupant",
        map_taxlot=MAP_TAXLOT,
    ))
    db_session.add(Parcel(
        hash_code="own0000000000001",
        account="ACCT-1",
        role="owner",
        map_taxlot=MAP_TAXLOT,
    ))
    await db_session.commit()

    response = await client.post("/allclear/parcels/resolve", json=_payload())
    assert response.status_code == 200
    assert response.json()["hash_code"] == "own0000000000001"


@pytest.mark.asyncio
async def test_resolve_rejects_blank_taxlot(client):
    response = await client.post("/allclear/parcels/resolve", json=_payload(map_taxlot="   "))
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_synthetic_hash_is_stable_and_prefixed():
    h1 = _synthetic_hash_code(MAP_TAXLOT)
    h2 = _synthetic_hash_code(MAP_TAXLOT)
    h3 = _synthetic_hash_code("DIFFERENT_TAXLOT")
    assert h1 == h2
    assert h1 != h3
    assert h1.startswith("g") and len(h1) == 16
