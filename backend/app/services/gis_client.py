import httpx

from app.config import settings

GIS_BASE_URL = "https://gis.ashland.or.us"


class GISServiceError(Exception):
    def __init__(self, status_code: int | None, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


class GISClient:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=GIS_BASE_URL,
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0),
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def get(self, path: str, params: dict | None = None) -> dict:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = await self._client.get(path, params=params)
                if response.status_code >= 500:
                    last_error = GISServiceError(
                        status_code=response.status_code,
                        detail=f"GIS service returned {response.status_code}",
                    )
                    if attempt < 2:
                        import asyncio
                        await asyncio.sleep(2 ** attempt)
                        continue
                    raise last_error
                if response.status_code >= 400:
                    raise GISServiceError(
                        status_code=response.status_code,
                        detail=f"GIS service returned {response.status_code}: {response.text[:200]}",
                    )
                return response.json()
            except httpx.TimeoutException as exc:
                last_error = GISServiceError(
                    status_code=None,
                    detail=f"GIS service timed out: {exc}",
                )
                if attempt < 2:
                    import asyncio
                    await asyncio.sleep(2 ** attempt)
                    continue
            except httpx.ConnectError as exc:
                last_error = GISServiceError(
                    status_code=None,
                    detail=f"GIS service connection error: {exc}",
                )
                if attempt < 2:
                    import asyncio
                    await asyncio.sleep(2 ** attempt)
                    continue
        raise last_error  # type: ignore[misc]


gis_client = GISClient()
