import httpx

LWF_BASE_URL = "https://lwf-api.vercel.app"


class PlantsApiError(Exception):
    def __init__(self, status_code: int | None, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


class PlantsClient:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=LWF_BASE_URL,
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0),
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def get(self, path: str, params: dict | None = None) -> dict:
        try:
            response = await self._client.get(path, params=params)
            if response.status_code >= 400:
                raise PlantsApiError(
                    status_code=response.status_code,
                    detail=f"Plants API returned {response.status_code}",
                )
            return response.json()
        except httpx.TimeoutException as exc:
            raise PlantsApiError(status_code=None, detail=f"Plants API timed out: {exc}")
        except httpx.ConnectError as exc:
            raise PlantsApiError(status_code=None, detail=f"Plants API connection error: {exc}")


plants_client = PlantsClient()
