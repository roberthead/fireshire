from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.routers import buildings, parcels, plants
from app.services.gis_client import GISServiceError, gis_client
from app.services.plants_client import PlantsApiError, plants_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await gis_client.close()
    await plants_client.close()


app = FastAPI(title="FireShire", version="0.1.0", lifespan=lifespan)

app.include_router(parcels.router)
app.include_router(buildings.router)
app.include_router(plants.router)


@app.exception_handler(GISServiceError)
async def gis_error_handler(request, exc: GISServiceError):
    return JSONResponse(
        status_code=503,
        content={"error": "gis_unavailable", "detail": exc.detail},
    )


@app.exception_handler(PlantsApiError)
async def plants_error_handler(request, exc: PlantsApiError):
    return JSONResponse(
        status_code=503,
        content={"error": "plants_api_unavailable", "detail": exc.detail},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
