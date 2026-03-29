from fastapi import APIRouter, Query

from app.services.gis_client import gis_client

router = APIRouter(prefix="/api")

BUILDINGS_URL = "/arcgis/rest/services/buildings/MapServer/0/query"

BUILDING_FIELDS = "OBJECTID,Bldg_name,BLDG_CLASS,ELEVATION,Floors,YR_BLT,SqFT,OCC_CODE"

# 100 feet in degrees (approximate at Ashland's latitude ~42N)
# 1 degree lat ≈ 364,000 ft, 1 degree lng ≈ 271,000 ft at 42N
BUFFER_FT = 100
LAT_BUFFER = BUFFER_FT / 364_000
LNG_BUFFER = BUFFER_FT / 271_000


def _esri_to_geojson_feature(feature: dict) -> dict:
    """Convert an Esri JSON feature to a GeoJSON Feature."""
    rings = feature.get("geometry", {}).get("rings", [])
    return {
        "type": "Feature",
        "properties": feature.get("attributes", {}),
        "geometry": {
            "type": "Polygon",
            "coordinates": rings,
        },
    }


@router.get("/buildings")
async def get_buildings(
    xmin: float = Query(...),
    ymin: float = Query(...),
    xmax: float = Query(...),
    ymax: float = Query(...),
):
    # Expand bbox by 100ft buffer
    envelope = {
        "xmin": xmin - LNG_BUFFER,
        "ymin": ymin - LAT_BUFFER,
        "xmax": xmax + LNG_BUFFER,
        "ymax": ymax + LAT_BUFFER,
    }

    all_features = []
    offset = 0
    page_size = 2000

    while True:
        # Use f=json because this MapServer does not support f=geojson
        data = await gis_client.get(
            BUILDINGS_URL,
            params={
                "geometry": f"{envelope['xmin']},{envelope['ymin']},{envelope['xmax']},{envelope['ymax']}",
                "geometryType": "esriGeometryEnvelope",
                "inSR": "4326",
                "spatialRel": "esriSpatialRelIntersects",
                "outFields": BUILDING_FIELDS,
                "outSR": "4326",
                "f": "json",
                "resultOffset": str(offset),
                "resultRecordCount": str(page_size),
            },
        )

        features = data.get("features", [])
        all_features.extend(_esri_to_geojson_feature(f) for f in features)

        if data.get("exceededTransferLimit") and len(features) == page_size:
            offset += page_size
        else:
            break

    return {
        "type": "FeatureCollection",
        "features": all_features,
    }
