from urllib.parse import unquote_plus

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


def _diane_parcel(siteadd="2770 DIANE ST", maplot="391E04AA1000"):
    return {
        "attributes": {
            "SITEADD": siteadd,
            "ADDRESSNUM": "2770",
            "STREETNAME": siteadd.split(" ", 1)[1] if " " in siteadd else "",
            "MAPLOT": maplot,
            "TM_MAPLOT": maplot,
            "ACREAGE": 0.18,
            "FEEOWNER": "DOE JANE",
        },
        "geometry": {
            "rings": [
                [
                    [-122.70, 42.20],
                    [-122.70, 42.201],
                    [-122.699, 42.201],
                    [-122.699, 42.20],
                    [-122.70, 42.20],
                ]
            ]
        },
    }


def _sibling_attrs(siteadd, maplot):
    return {"attributes": {
        "SITEADD": siteadd,
        "ADDRESSNUM": siteadd.split()[0] if siteadd.split() else "",
        "STREETNAME": " ".join(siteadd.split()[1:]),
        "MAPLOT": maplot,
        "ACREAGE": 0.18,
        "FEEOWNER": "DOE JANE",
    }}


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
        side_effect=[
            httpx.Response(200, json={"features": []}),
            httpx.Response(200, json={"features": []}),
        ]
    )
    response = await client.get("/parcels", params={"address": "99999 Nowhere"})
    assert response.status_code == 200
    assert response.json()["parcels"] == []


@respx.mock
@pytest.mark.asyncio
async def test_parcel_lookup_normalizes_address(client):
    route = respx.get(TAXLOTS_URL).mock(
        side_effect=[
            httpx.Response(200, json={"features": []}),
            httpx.Response(200, json={"features": []}),
        ]
    )
    await client.get("/parcels", params={"address": "  570  siskiyou  "})
    request = route.calls[0].request
    decoded_url = unquote_plus(str(request.url))
    assert "ADDRESSNUM" in decoded_url
    assert "SISKIYOU" in decoded_url


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


# ---- New tests for flexible address matching ----------------------------


@respx.mock
@pytest.mark.asyncio
async def test_suffix_normalization_street_to_st(client):
    route = respx.get(TAXLOTS_URL).mock(
        return_value=httpx.Response(200, json={"features": [_diane_parcel()]})
    )
    response = await client.get("/parcels", params={"address": "2770 Diane Street"})
    assert response.status_code == 200
    decoded = unquote_plus(str(route.calls[0].request.url))
    assert "STREETNAME" in decoded
    assert "LIKE" in decoded
    assert "DIANE ST%" in decoded


@respx.mock
@pytest.mark.asyncio
async def test_suffix_normalization_avenue_to_ave(client):
    route = respx.get(TAXLOTS_URL).mock(
        return_value=httpx.Response(
            200,
            json={"features": [_diane_parcel(siteadd="100 N MAIN AVE",
                                              maplot="391E05AA0001")]},
        )
    )
    await client.get("/parcels", params={"address": "100 N Main Avenue"})
    decoded = unquote_plus(str(route.calls[0].request.url))
    assert "N MAIN AVE" in decoded


@respx.mock
@pytest.mark.asyncio
async def test_directional_normalization(client):
    route = respx.get(TAXLOTS_URL).mock(
        side_effect=[
            httpx.Response(200, json={"features": []}),
            httpx.Response(200, json={"features": []}),
        ]
    )
    await client.get("/parcels", params={"address": "100 North Main"})
    decoded = unquote_plus(str(route.calls[0].request.url))
    assert "N MAIN" in decoded


@respx.mock
@pytest.mark.asyncio
async def test_fuzzy_fallback_promotes_high_score(client):
    # Three sequential calls:
    #   1) primary STREETNAME query — no hits
    #   2) sibling ADDRESSNUM query — three candidates
    #   3) geometry refetch by MAPLOT — DIANE parcel with rings
    sibling_features = [
        _sibling_attrs("2770 DIANE ST", "391E04AA1000"),
        _sibling_attrs("2770 OTHER ST", "391E04AA1001"),
        _sibling_attrs("2770 ANOTHER WAY", "391E04AA1002"),
    ]
    route = respx.get(TAXLOTS_URL).mock(
        side_effect=[
            httpx.Response(200, json={"features": []}),
            httpx.Response(200, json={"features": sibling_features}),
            httpx.Response(
                200,
                json={"features": [_diane_parcel()]},
            ),
        ]
    )
    response = await client.get("/parcels", params={"address": "2770 Dianne St"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["parcels"]) == 1
    assert data["parcels"][0]["address"] == "2770 DIANE ST"
    assert data["suggestions"] == []
    assert len(route.calls) == 3


@respx.mock
@pytest.mark.asyncio
async def test_fuzzy_fallback_returns_suggestions(client):
    # Both candidates score in the 70-84 band: above the suggestion floor
    # but below the auto-promote threshold (and within the runner-up margin).
    sibling_features = [
        _sibling_attrs("2770 DIANE AVE", "391E04AA9001"),
        _sibling_attrs("2770 DIANE BLVD", "391E04AA9002"),
    ]
    respx.get(TAXLOTS_URL).mock(
        side_effect=[
            httpx.Response(200, json={"features": []}),
            httpx.Response(200, json={"features": sibling_features}),
        ]
    )
    response = await client.get("/parcels", params={"address": "2770 DIANE ST"})
    assert response.status_code == 200
    data = response.json()
    assert data["parcels"] == []
    assert len(data["suggestions"]) >= 1
    scores = [s["score"] for s in data["suggestions"]]
    assert scores == sorted(scores, reverse=True)


@respx.mock
@pytest.mark.asyncio
async def test_fuzzy_fallback_no_candidates(client):
    respx.get(TAXLOTS_URL).mock(
        side_effect=[
            httpx.Response(200, json={"features": []}),
            httpx.Response(200, json={"features": []}),
        ]
    )
    response = await client.get("/parcels", params={"address": "9999 NOWHERE ST"})
    assert response.status_code == 200
    data = response.json()
    assert data["parcels"] == []
    assert data["suggestions"] == []


@respx.mock
@pytest.mark.asyncio
async def test_sql_injection_single_quote_escaped(client):
    route = respx.get(TAXLOTS_URL).mock(
        side_effect=[
            httpx.Response(200, json={"features": []}),
            httpx.Response(200, json={"features": []}),
        ]
    )
    await client.get("/parcels", params={"address": "2770 O'Brien St"})
    decoded = unquote_plus(str(route.calls[0].request.url))
    # Doubled quote present
    assert "O''BRIEN" in decoded
    # No lone unescaped apostrophe immediately after BRIEN that would close
    # the SQL string prematurely. Specifically `BRIEN'` followed by anything
    # other than another `'` is unsafe.
    idx = decoded.find("O''BRIEN")
    assert idx != -1
    # Ensure there is NOT a single-apostrophe form anywhere in the URL.
    assert "O'BRIEN" not in decoded.replace("O''BRIEN", "")


@respx.mock
@pytest.mark.asyncio
async def test_response_includes_suggestions_field(client):
    respx.get(TAXLOTS_URL).mock(
        return_value=httpx.Response(200, json={"features": [SAMPLE_PARCEL]})
    )
    response = await client.get("/parcels", params={"address": "570 Siskiyou"})
    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    assert data["suggestions"] == []
