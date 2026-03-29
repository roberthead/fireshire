import httpx
import pytest
import respx


TAXLOTS_URL = "https://gis.ashland.or.us/arcgis/rest/services/taxlots/FeatureServer/0/query"

SAMPLE_PARCEL = {
    "attributes": {
        "SITEADD": "570 SISKIYOU BLVD",
        "ADDRESSNUM": "570",
        "STREETNAME": "SISKIYOU BLVD",
        "MAPLOT": "391E04CB6200",
        "TM_MAPLOT": "39-1E-04CB-6200",
        "ACREAGE": 0.25,
        "FEEOWNER": "SMITH JOHN",
    },
    "geometry": {
        "rings": [
            [
                [-122.71, 42.19],
                [-122.71, 42.191],
                [-122.709, 42.191],
                [-122.709, 42.19],
                [-122.71, 42.19],
            ]
        ]
    },
}


@respx.mock
@pytest.mark.asyncio
async def test_parcel_lookup_success(client):
    respx.get(TAXLOTS_URL).mock(
        return_value=httpx.Response(200, json={"features": [SAMPLE_PARCEL]})
    )
    response = await client.get("/parcels", params={"address": "570 Siskiyou"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["parcels"]) == 1
    parcel = data["parcels"][0]
    assert parcel["address"] == "570 SISKIYOU BLVD"
    assert parcel["taxlot_id"] == "391E04CB6200"
    assert parcel["acreage"] == 0.25
    assert parcel["centroid"]["lat"] == pytest.approx(42.19, abs=0.01)
    assert parcel["centroid"]["lng"] == pytest.approx(-122.71, abs=0.01)
    assert parcel["geometry"]["type"] == "Polygon"


@respx.mock
@pytest.mark.asyncio
async def test_parcel_lookup_no_results(client):
    respx.get(TAXLOTS_URL).mock(
        return_value=httpx.Response(200, json={"features": []})
    )
    response = await client.get("/parcels", params={"address": "99999 Nowhere"})
    assert response.status_code == 200
    assert response.json()["parcels"] == []


@respx.mock
@pytest.mark.asyncio
async def test_parcel_lookup_normalizes_address(client):
    route = respx.get(TAXLOTS_URL).mock(
        return_value=httpx.Response(200, json={"features": []})
    )
    await client.get("/parcels", params={"address": "  570  siskiyou  "})
    # Verify the where clause was uppercased and whitespace-collapsed
    from urllib.parse import unquote_plus
    request = route.calls[0].request
    decoded_url = unquote_plus(str(request.url))
    assert "570 SISKIYOU" in decoded_url


@respx.mock
@pytest.mark.asyncio
async def test_parcel_lookup_gis_failure(client):
    respx.get(TAXLOTS_URL).mock(
        return_value=httpx.Response(502, text="Bad Gateway")
    )
    response = await client.get("/parcels", params={"address": "570 Siskiyou"})
    assert response.status_code == 503
    assert response.json()["error"] == "gis_unavailable"


@pytest.mark.asyncio
async def test_parcel_lookup_requires_address(client):
    response = await client.get("/parcels")
    assert response.status_code == 422
