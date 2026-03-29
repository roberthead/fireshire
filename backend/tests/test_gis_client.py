import httpx
import pytest
import respx

from app.services.gis_client import GISClient, GISServiceError


@pytest.fixture
async def gis():
    client = GISClient()
    yield client
    await client.close()


@respx.mock
@pytest.mark.asyncio
async def test_successful_request(gis: GISClient):
    respx.get("https://gis.ashland.or.us/test").mock(
        return_value=httpx.Response(200, json={"type": "FeatureCollection", "features": []})
    )
    result = await gis.get("/test")
    assert result == {"type": "FeatureCollection", "features": []}


@respx.mock
@pytest.mark.asyncio
async def test_retry_then_success(gis: GISClient):
    route = respx.get("https://gis.ashland.or.us/test")
    route.side_effect = [
        httpx.Response(502, text="Bad Gateway"),
        httpx.Response(200, json={"ok": True}),
    ]
    result = await gis.get("/test")
    assert result == {"ok": True}
    assert route.call_count == 2


@respx.mock
@pytest.mark.asyncio
async def test_exhausted_retries(gis: GISClient):
    respx.get("https://gis.ashland.or.us/test").mock(
        return_value=httpx.Response(502, text="Bad Gateway")
    )
    with pytest.raises(GISServiceError) as exc_info:
        await gis.get("/test")
    assert exc_info.value.status_code == 502
    assert "502" in exc_info.value.detail


@respx.mock
@pytest.mark.asyncio
async def test_timeout_raises_gis_error(gis: GISClient):
    respx.get("https://gis.ashland.or.us/test").mock(
        side_effect=httpx.ReadTimeout("read timed out")
    )
    with pytest.raises(GISServiceError) as exc_info:
        await gis.get("/test")
    assert exc_info.value.status_code is None
    assert "timed out" in exc_info.value.detail


@respx.mock
@pytest.mark.asyncio
async def test_connection_error_raises_gis_error(gis: GISClient):
    respx.get("https://gis.ashland.or.us/test").mock(
        side_effect=httpx.ConnectError("connection refused")
    )
    with pytest.raises(GISServiceError) as exc_info:
        await gis.get("/test")
    assert exc_info.value.status_code is None
    assert "connection error" in exc_info.value.detail


@respx.mock
@pytest.mark.asyncio
async def test_4xx_no_retry(gis: GISClient):
    route = respx.get("https://gis.ashland.or.us/test")
    route.mock(return_value=httpx.Response(404, text="Not Found"))
    with pytest.raises(GISServiceError) as exc_info:
        await gis.get("/test")
    assert exc_info.value.status_code == 404
    assert route.call_count == 1  # no retry on 4xx


@respx.mock
@pytest.mark.asyncio
async def test_exception_handler_returns_503(client):
    respx.get("https://gis.ashland.or.us/arcgis/rest/services/test").mock(
        return_value=httpx.Response(502, text="Bad Gateway")
    )
    # Import here to register a test route that uses the gis_client
    from app.main import app
    from app.services.gis_client import gis_client

    @app.get("/test-gis-error")
    async def test_endpoint():
        return await gis_client.get("/arcgis/rest/services/test")

    response = await client.get("/test-gis-error")
    assert response.status_code == 503
    body = response.json()
    assert body["error"] == "gis_unavailable"
    assert "502" in body["detail"]
