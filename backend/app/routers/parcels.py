from fastapi import APIRouter, Query

from app.services.gis_client import gis_client

router = APIRouter()

TAXLOTS_URL = "/arcgis/rest/services/taxlots/FeatureServer/0/query"

PARCEL_FIELDS = "SITEADD,ADDRESSNUM,STREETNAME,MAPLOT,TM_MAPLOT,ACREAGE,FEEOWNER"


def normalize_address(address: str) -> str:
    return " ".join(address.upper().split())


@router.get("/parcels")
async def lookup_parcels(address: str = Query(..., min_length=2)):
    normalized = normalize_address(address)

    data = await gis_client.get(
        TAXLOTS_URL,
        params={
            "where": f"UPPER(SITEADD) LIKE '%{normalized}%'",
            "outFields": PARCEL_FIELDS,
            "outSR": "4326",
            "f": "json",
            "resultRecordCount": "10",
            "returnGeometry": "true",
        },
    )

    features = data.get("features", [])
    seen: set[str] = set()
    results = []
    for feat in features:
        attrs = feat.get("attributes", {})
        geom = feat.get("geometry", {})
        rings = geom.get("rings", [])

        if not rings:
            continue

        taxlot_id = attrs.get("MAPLOT") or attrs.get("TM_MAPLOT") or ""
        if taxlot_id in seen:
            continue
        seen.add(taxlot_id)

        # Compute centroid from the first ring
        ring = rings[0]
        if ring:
            lngs = [p[0] for p in ring]
            lats = [p[1] for p in ring]
            centroid = {
                "lng": sum(lngs) / len(lngs),
                "lat": sum(lats) / len(lats),
            }
        else:
            centroid = None

        results.append(
            {
                "address": (attrs.get("SITEADD") or "").strip(),
                "taxlot_id": taxlot_id,
                "acreage": attrs.get("ACREAGE"),
                "owner": (attrs.get("FEEOWNER") or "").strip(),
                "centroid": centroid,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": rings,
                },
            }
        )

    return {"parcels": results}
