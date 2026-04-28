from fastapi import APIRouter, Query
from rapidfuzz import fuzz

from app.services.address_normalizer import (
    escape_sql_literal,
    normalize_address,
    parse_address,
)
from app.services.gis_client import gis_client

router = APIRouter()

TAXLOTS_URL = "/arcgis/rest/services/taxlots/FeatureServer/0/query"

PARCEL_FIELDS = "SITEADD,ADDRESSNUM,STREETNAME,MAPLOT,TM_MAPLOT,ACREAGE,FEEOWNER"
SIBLING_FIELDS = "SITEADD,ADDRESSNUM,STREETNAME,MAPLOT,ACREAGE,FEEOWNER"

PROMOTE_THRESHOLD = 85
SUGGEST_THRESHOLD = 70
PROMOTE_MARGIN = 5
MAX_SUGGESTIONS = 5


def _build_parcels(features: list) -> list[dict]:
    """Replicate the existing dedup + centroid logic for taxlot features."""
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


@router.get("/parcels")
async def lookup_parcels(address: str = Query(..., min_length=2)):
    parsed = parse_address(address)
    normalized = normalize_address(address)

    # If parsing yielded no street, we cannot build a meaningful query.
    if not parsed["street"]:
        return {"parcels": [], "suggestions": []}

    number = parsed["number"]
    street = parsed["street"]
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

    parcels = _build_parcels(data.get("features", []))

    suggestions: list[dict] = []

    # Fuzzy fallback: only meaningful when we have a number and got no hits.
    if not parcels and number:
        sibling_data = await gis_client.get(
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

        scored: list[dict] = []
        for feat in sibling_data.get("features", []):
            attrs = feat.get("attributes", {})
            siteadd = (attrs.get("SITEADD") or "").strip()
            taxlot_id = attrs.get("MAPLOT") or ""
            if not siteadd or not taxlot_id:
                continue
            score = fuzz.WRatio(normalized, siteadd)
            if score >= SUGGEST_THRESHOLD:
                scored.append(
                    {
                        "address": siteadd,
                        "taxlot_id": taxlot_id,
                        "score": int(round(score)),
                    }
                )

        scored.sort(key=lambda s: s["score"], reverse=True)
        scored = scored[:MAX_SUGGESTIONS]

        # Promotion: top score is high AND clearly ahead of the runner-up.
        if scored:
            top = scored[0]
            margin_ok = (
                len(scored) == 1
                or (top["score"] - scored[1]["score"]) >= PROMOTE_MARGIN
            )
            if top["score"] >= PROMOTE_THRESHOLD and margin_ok:
                promo_data = await gis_client.get(
                    TAXLOTS_URL,
                    params={
                        "where": (
                            f"MAPLOT = '{escape_sql_literal(top['taxlot_id'])}'"
                        ),
                        "outFields": PARCEL_FIELDS,
                        "outSR": "4326",
                        "f": "json",
                        "resultRecordCount": "1",
                        "returnGeometry": "true",
                    },
                )
                promoted = _build_parcels(promo_data.get("features", []))
                if promoted:
                    parcels.extend(promoted)
                    # Drop the promoted entry from suggestions.
                    scored = [
                        s for s in scored if s["taxlot_id"] != top["taxlot_id"]
                    ]

        suggestions = scored

    return {"parcels": parcels, "suggestions": suggestions}
