import logging

from fastapi import APIRouter, Query

from app.services.plants_client import plants_client

logger = logging.getLogger(__name__)

router = APIRouter()

HIZ_ATTRIBUTE_ID = "b908b170-70c9-454d-a2ed-d86f98cb3de1"

# Curated attribute set surfaced in the plant detail lightbox. HIZ stays first
# because callers (e.g. zone filtering / suitability) depend on it being present.
ATTRIBUTE_IDS = ",".join([
    HIZ_ATTRIBUTE_ID,                              # Home Ignition Zone (HIZ)
    "a8b73bcb-a997-4778-8415-13493a61b40d",        # Flammability
    "34b147da-613b-4df7-8eb9-76fd10e1d7ae",        # Flammability Notes
    "7f1ae001-0001-4000-8000-000000000001",        # Fire Risk Indicators
    "9caeaf11-007f-425d-8200-84d4116b8b53",        # Chemical content
    "1ddbe951-69ef-4b4b-aa20-75b97cb0207c",        # Ashland (noxious / prohibited bands)
    "af3e70d2-dc9c-4027-a09f-15d7d8b0dd10",        # Drought Tolerant
    "f0b45dc9-ee00-479a-8181-b4fda01f5233",        # Hardiness Zone
    "ce4ce677-b02f-4d7d-b7f3-10052b65c03a",        # Habit/Form
    "7a34c095-d01d-494e-8b30-55a8cd386790",        # Bark
    "ff75e529-5b5c-4461-8191-0382e33a4bd5",        # Benefits (pollinator / wildlife)
    "ca684872-8841-420e-a85b-b6d247b5b96e",        # Bloom Time
    "86a95833-886a-42bf-b149-c3754e9d913a",        # Flower Color
    "3716c310-ee59-4a31-a7c4-ad86dabfc82a",        # Border & Screening Use
    "693acb4c-d593-4168-9a01-6f934933bd8a",        # Erosion control
    "52c06414-5607-4846-beb5-e4f7cfe6c7f2",        # Edibility
    "ff4c4d0e-35d5-4804-aea3-2a6334ef8cb5",        # Deer Resistance
])


@router.get("/plants")
async def get_plants(
    zones: str | None = Query(None, description="Comma-separated zone display names, e.g. '0-5,10-30'"),
    search: str | None = Query(None),
    limit: int | None = Query(None, ge=1, le=200),
    offset: int | None = Query(None, ge=0),
):
    base_params: dict = {
        "attributeIds": ATTRIBUTE_IDS,
        "includeImages": "true",
    }
    if search:
        base_params["search"] = search
    if zones:
        base_params["zones"] = zones

    upstream_path = "/api/v2/plants"

    # If caller supplied an explicit limit, forward that single request
    if limit is not None:
        params = base_params.copy()
        params["limit"] = str(limit)
        params["offset"] = str(offset or 0)
        logger.info("GET %s params=%s", upstream_path, params)
        return await plants_client.get(upstream_path, params=params)

    # No explicit limit: fetch all pages from upstream by paging until hasMore is false
    all_data: list = []
    page_limit = 200
    current_offset = offset or 0
    first_meta = None

    while True:
        params = base_params.copy()
        params["limit"] = str(page_limit)
        params["offset"] = str(current_offset)
        logger.info("GET %s params=%s (paging)", upstream_path, params)
        resp = await plants_client.get(upstream_path, params=params)
        data_chunk = resp.get("data", [])
        all_data.extend(data_chunk)
        meta = resp.get("meta")
        if first_meta is None:
            first_meta = meta
        pagination = (meta or {}).get("pagination", {})
        has_more = bool(pagination.get("hasMore"))
        if not has_more:
            break
        # Advance offset by the page size reported by upstream if available
        advance = pagination.get("limit") or page_limit
        current_offset += int(advance)

    return {
        "data": all_data,
        "meta": {"pagination": {"total": len(all_data), "limit": len(all_data), "offset": 0, "hasMore": False}},
    }
