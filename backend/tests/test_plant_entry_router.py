"""Router tests for /plant-entries."""

import uuid

import pytest
from sqlalchemy import text

from app.crud import plant_entries as crud


@pytest.fixture(autouse=True)
async def _reset_plant_entries(db_session):
    await db_session.execute(text("DELETE FROM plant_entries"))
    await db_session.commit()
    yield


TAXLOT = "391E09BC 3200"


def _body(**overrides):
    base = {
        "taxlot_id": TAXLOT,
        "zone": "5-10",
        "plant_name": "Rosemary",
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_post_valid_entry_returns_201(client):
    response = await client.post("/plant-entries", json=_body())
    assert response.status_code == 201
    data = response.json()
    assert data["plant_name"] == "Rosemary"
    assert data["zone"] == "5-10"
    assert data["source"] == "manual"
    assert data["plant_id"] is None
    uuid.UUID(data["id"])


@pytest.mark.asyncio
async def test_post_invalid_zone_returns_422(client):
    response = await client.post("/plant-entries", json=_body(zone="bogus"))
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_post_exceeding_cap_returns_409(client, monkeypatch):
    monkeypatch.setattr(crud, "ZONE_CAP", 2)

    for i in range(2):
        r = await client.post("/plant-entries", json=_body(plant_name=f"P{i}"))
        assert r.status_code == 201

    r = await client.post("/plant-entries", json=_body(plant_name="Overflow"))
    assert r.status_code == 409
    assert r.json()["error"] == "zone_cap_exceeded"


@pytest.mark.asyncio
async def test_get_by_taxlot_excludes_soft_deleted(client):
    r1 = await client.post("/plant-entries", json=_body(plant_name="Alive"))
    r2 = await client.post("/plant-entries", json=_body(plant_name="Dead"))
    dead_id = r2.json()["id"]

    await client.delete(f"/plant-entries/{dead_id}")

    response = await client.get("/plant-entries", params={"taxlot_id": TAXLOT})
    assert response.status_code == 200
    names = [e["plant_name"] for e in response.json()["entries"]]
    assert names == ["Alive"]
    _ = r1


@pytest.mark.asyncio
async def test_patch_zone_change(client):
    r = await client.post("/plant-entries", json=_body(zone="5-10"))
    entry_id = r.json()["id"]

    response = await client.patch(
        f"/plant-entries/{entry_id}", json={"zone": "30-100"}
    )
    assert response.status_code == 200
    assert response.json()["zone"] == "30-100"


@pytest.mark.asyncio
async def test_patch_on_soft_deleted_returns_404(client):
    r = await client.post("/plant-entries", json=_body())
    entry_id = r.json()["id"]
    await client.delete(f"/plant-entries/{entry_id}")

    response = await client.patch(
        f"/plant-entries/{entry_id}", json={"plant_name": "Zombie"}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_patch_missing_id_returns_404(client):
    response = await client.patch(
        f"/plant-entries/{uuid.uuid4()}", json={"plant_name": "Ghost"}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_returns_204_and_is_idempotent(client):
    r = await client.post("/plant-entries", json=_body())
    entry_id = r.json()["id"]

    first = await client.delete(f"/plant-entries/{entry_id}")
    assert first.status_code == 204

    listing = await client.get("/plant-entries", params={"taxlot_id": TAXLOT})
    assert listing.json()["entries"] == []

    second = await client.delete(f"/plant-entries/{entry_id}")
    assert second.status_code == 204


@pytest.mark.asyncio
async def test_delete_nonexistent_returns_404(client):
    response = await client.delete(f"/plant-entries/{uuid.uuid4()}")
    assert response.status_code == 404
