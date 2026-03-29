import httpx
import pytest
import respx


BUILDINGS_URL = "https://gis.ashland.or.us/arcgis/rest/services/buildings/MapServer/0/query"

# Esri JSON format (what the MapServer actually returns with f=json)
SAMPLE_ESRI_BUILDING = {
    "attributes": {
        "OBJECTID": 1,
        "Bldg_name": "Main House",
        "BLDG_CLASS": "R",
        "Floors": 2,
        "YR_BLT": "1985",
        "SqFT": 1800,
    },
    "geometry": {
        "rings": [
            [
                [-122.71, 42.19],
                [-122.71, 42.1901],
                [-122.7099, 42.1901],
                [-122.7099, 42.19],
                [-122.71, 42.19],
            ]
        ],
    },
}


@respx.mock
@pytest.mark.asyncio
async def test_buildings_success(client):
    respx.get(BUILDINGS_URL).mock(
        return_value=httpx.Response(
            200,
            json={"features": [SAMPLE_ESRI_BUILDING]},
        )
    )
    response = await client.get(
        "/buildings",
        params={"xmin": -122.71, "ymin": 42.19, "xmax": -122.70, "ymax": 42.20},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 1
    assert data["features"][0]["properties"]["Bldg_name"] == "Main House"


@respx.mock
@pytest.mark.asyncio
async def test_buildings_no_results(client):
    respx.get(BUILDINGS_URL).mock(
        return_value=httpx.Response(
            200,
            json={"features": []},
        )
    )
    response = await client.get(
        "/buildings",
        params={"xmin": -122.71, "ymin": 42.19, "xmax": -122.70, "ymax": 42.20},
    )
    assert response.status_code == 200
    assert response.json()["features"] == []


@respx.mock
@pytest.mark.asyncio
async def test_buildings_pagination(client):
    page1_features = [SAMPLE_ESRI_BUILDING] * 2000
    page2_features = [SAMPLE_ESRI_BUILDING] * 500

    route = respx.get(BUILDINGS_URL)
    route.side_effect = [
        httpx.Response(
            200,
            json={
                "features": page1_features,
                "exceededTransferLimit": True,
            },
        ),
        httpx.Response(
            200,
            json={"features": page2_features},
        ),
    ]
    response = await client.get(
        "/buildings",
        params={"xmin": -122.71, "ymin": 42.19, "xmax": -122.70, "ymax": 42.20},
    )
    assert response.status_code == 200
    assert len(response.json()["features"]) == 2500
    assert route.call_count == 2


@respx.mock
@pytest.mark.asyncio
async def test_buildings_gis_failure(client):
    respx.get(BUILDINGS_URL).mock(
        return_value=httpx.Response(502, text="Bad Gateway")
    )
    response = await client.get(
        "/buildings",
        params={"xmin": -122.71, "ymin": 42.19, "xmax": -122.70, "ymax": 42.20},
    )
    assert response.status_code == 503
    assert response.json()["error"] == "gis_unavailable"


@pytest.mark.asyncio
async def test_buildings_requires_bbox(client):
    response = await client.get("/buildings")
    assert response.status_code == 422
