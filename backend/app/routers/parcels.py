from fastapi import APIRouter, Query

from app.services.address_search import run_fuzzy_search
from app.services.address_normalizer import escape_sql_literal
from app.services.gis_client import gis_client

router = APIRouter()

TAXLOTS_URL = "/arcgis/rest/services/taxlots/FeatureServer/0/query"

PARCEL_FIELDS = "SITEADD,ADDRESSNUM,STREETNAME,MAPLOT,TM_MAPLOT,ACREAGE,FEEOWNER"
SIBLING_FIELDS = "SITEADD,ADDRESSNUM,STREETNAME,MAPLOT,ACREAGE,FEEOWNER"


def _build_parcels(features: list) -> list[dict]:
    """Dedup taxlots and compute polygon centroids for map rendering."""
    seen: set[str] = set()
    results: list[dict] = []
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
    return results


async def _fetch_primary(number: str | None, street: str) -> list[dict]:
    street_escaped = escape_sql_literal(street)
    if number:
        number_escaped = escape_sql_literal(number)
        where = (
            f"ADDRESSNUM = '{number_escaped}' "
            f"AND UPPER(STREETNAME) LIKE '{street_escaped}%'"
        )
    else:
        where = f"UPPER(STREETNAME) LIKE '%{street_escaped}%'"

    data = await gis_client.get(
        TAXLOTS_URL,
        params={
            "where": where,
            "outFields": PARCEL_FIELDS,
            "outSR": "4326",
            "f": "json",
            "resultRecordCount": "10",
            "returnGeometry": "true",
        },
    )
    return _build_parcels(data.get("features", []))


async def _fetch_siblings(number: str) -> list[dict]:
    data = await gis_client.get(
        TAXLOTS_URL,
        params={
            "where": f"ADDRESSNUM = '{escape_sql_literal(number)}'",
            "outFields": SIBLING_FIELDS,
            "outSR": "4326",
            "f": "json",
            "resultRecordCount": "50",
            "returnGeometry": "false",
        },
    )
    siblings: list[dict] = []
    for feat in data.get("features", []):
        attrs = feat.get("attributes", {})
        siteadd = (attrs.get("SITEADD") or "").strip()
        taxlot_id = attrs.get("MAPLOT") or ""
        if not siteadd or not taxlot_id:
            continue
        siblings.append({"address": siteadd, "taxlot_id": taxlot_id})
    return siblings


async def _fetch_by_id(taxlot_id: str) -> dict | None:
    data = await gis_client.get(
        TAXLOTS_URL,
        params={
            "where": f"MAPLOT = '{escape_sql_literal(taxlot_id)}'",
            "outFields": PARCEL_FIELDS,
            "outSR": "4326",
            "f": "json",
            "resultRecordCount": "1",
            "returnGeometry": "true",
        },
    )
    built = _build_parcels(data.get("features", []))
    return built[0] if built else None


@router.get("/parcels")
async def lookup_parcels(address: str = Query(..., min_length=2)):
    return await run_fuzzy_search(
        address,
        fetch_primary=_fetch_primary,
        fetch_siblings=_fetch_siblings,
        fetch_by_id=_fetch_by_id,
        id_key="taxlot_id",
    )
