import csv
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.database import engine, Base
from app.routers import buildings, chat, parcels, plants
from app.routers.allclear import router as allclear_router, load_hoa_list
from app.services.chat_client import AnthropicError, chat_client
from app.services.gis_client import GISServiceError, gis_client
from app.services.plants_client import PlantsApiError, plants_client

# Import models so Base.metadata knows about them
import app.models  # noqa: F401


def _load_hoa_csv() -> list[dict]:
    """Load HOA list from CSV if available."""
    hoa_path = os.path.join(os.path.dirname(__file__), "..", "data", "ashland_hoa_master.csv")
    if not os.path.exists(hoa_path):
        return []
    with open(hoa_path, newline="", encoding="utf-8") as f:
        return [
            {
                "hoa_name": row["hoa_name"],
                "subdivision_name": row.get("subdivision_name", ""),
                "website": row.get("website", ""),
                "phone": row.get("phone", ""),
            }
            for row in csv.DictReader(f)
        ]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if they don't exist (safe for Neon — idempotent)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Load static HOA data
    load_hoa_list(_load_hoa_csv())
    yield
    await gis_client.close()
    await plants_client.close()
    await chat_client.close()
    await engine.dispose()


app = FastAPI(title="FireShire", version="0.1.0", lifespan=lifespan)

app.include_router(parcels.router)
app.include_router(buildings.router)
app.include_router(plants.router)
app.include_router(chat.router)
app.include_router(allclear_router)


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


@app.exception_handler(AnthropicError)
async def anthropic_error_handler(request, exc: AnthropicError):
    return JSONResponse(
        status_code=503,
        content={"error": "chat_unavailable", "detail": str(exc)},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
