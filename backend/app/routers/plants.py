import logging

from fastapi import APIRouter, Query

from app.services.plants_client import plants_client

logger = logging.getLogger(__name__)

router = APIRouter()

HIZ_ATTRIBUTE_ID = "b908b170-70c9-454d-a2ed-d86f98cb3de1"


@router.get("/plants")
async def get_plants(
    zones: str | None = Query(None, description="Comma-separated zone display names, e.g. '0-5,10-30'"),
    search: str | None = Query(None),
    limit: int | None = Query(None, ge=1, le=200),
    offset: int | None = Query(None, ge=0),
):
    base_params: dict = {
        "attributeIds": HIZ_ATTRIBUTE_ID,
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
