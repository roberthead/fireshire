from fastapi import APIRouter, Query

from app.services.plants_client import plants_client

router = APIRouter()

HIZ_ATTRIBUTE_ID = "b908b170-70c9-454d-a2ed-d86f98cb3de1"


@router.get("/plants")
async def get_plants(
    zones: str | None = Query(None, description="Comma-separated zone display names, e.g. '0-5,10-30'"),
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    params: dict = {
        "attributeIds": HIZ_ATTRIBUTE_ID,
        "includeImages": "true",
        "limit": str(limit),
        "offset": str(offset),
    }
    if search:
        params["search"] = search
    if zones:
        params["zones"] = zones

    return await plants_client.get("/api/v2/plants", params=params)
