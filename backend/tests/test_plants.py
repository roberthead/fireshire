import httpx
import pytest
import respx


LWF_PLANTS_URL = "https://lwf-api.vercel.app/api/v2/plants"

SAMPLE_PLANT_RESPONSE = {
    "data": [
        {
            "id": "1b78126d-test",
            "genus": "Abelia",
            "species": "x grandiflora",
            "commonName": "Glossy abelia",
            "primaryImage": {
                "id": "img-1",
                "url": "https://example.com/abelia.jpg",
                "caption": None,
            },
            "values": [
                {
                    "attributeId": "b908b170-70c9-454d-a2ed-d86f98cb3de1",
                    "attributeName": "Home Ignition Zone (HIZ)",
                    "rawValue": "03",
                    "resolved": {"value": "10-30", "type": "text", "id": "val-1"},
                }
            ],
        }
    ],
    "meta": {"pagination": {"total": 1, "limit": 50, "offset": 0, "hasMore": False}},
}


@respx.mock
@pytest.mark.asyncio
async def test_get_plants_success(client):
    respx.get(LWF_PLANTS_URL).mock(
        return_value=httpx.Response(200, json=SAMPLE_PLANT_RESPONSE)
    )
    response = await client.get("/plants")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 1
    assert data["data"][0]["commonName"] == "Glossy abelia"


@respx.mock
@pytest.mark.asyncio
async def test_get_plants_with_zones(client):
    route = respx.get(LWF_PLANTS_URL).mock(
        return_value=httpx.Response(200, json=SAMPLE_PLANT_RESPONSE)
    )
    response = await client.get("/plants", params={"zones": "0-5,10-30"})
    assert response.status_code == 200
    request = route.calls[0].request
    assert "zones=0-5%2C10-30" in str(request.url) or "zones=0-5,10-30" in str(request.url)


@respx.mock
@pytest.mark.asyncio
async def test_get_plants_with_search(client):
    route = respx.get(LWF_PLANTS_URL).mock(
        return_value=httpx.Response(200, json=SAMPLE_PLANT_RESPONSE)
    )
    response = await client.get("/plants", params={"search": "abelia"})
    assert response.status_code == 200
    request = route.calls[0].request
    assert "search=abelia" in str(request.url)


@respx.mock
@pytest.mark.asyncio
async def test_get_plants_pagination(client):
    route = respx.get(LWF_PLANTS_URL).mock(
        return_value=httpx.Response(200, json=SAMPLE_PLANT_RESPONSE)
    )
    response = await client.get("/plants", params={"limit": "10", "offset": "20"})
    assert response.status_code == 200
    request = route.calls[0].request
    assert "limit=10" in str(request.url)
    assert "offset=20" in str(request.url)


@respx.mock
@pytest.mark.asyncio
async def test_get_plants_upstream_failure(client):
    respx.get(LWF_PLANTS_URL).mock(
        return_value=httpx.Response(500, text="Internal Server Error")
    )
    response = await client.get("/plants")
    assert response.status_code == 503
    assert response.json()["error"] == "plants_api_unavailable"


@respx.mock
@pytest.mark.asyncio
async def test_get_plants_upstream_timeout(client):
    respx.get(LWF_PLANTS_URL).mock(side_effect=httpx.ReadTimeout("timeout"))
    response = await client.get("/plants")
    assert response.status_code == 503
    assert response.json()["error"] == "plants_api_unavailable"
