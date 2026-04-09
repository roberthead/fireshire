"""AllClear endpoints — parcel lookup, survey submission, progress tracking, HOA list."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Parcel, UserProgress, SurveyResponse, MapResult

router = APIRouter(prefix="/allclear", tags=["allclear"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class ParcelOut(BaseModel):
    hash_code: str
    account: str
    role: str
    owner_name: str | None
    situs_address: str | None
    mailing_address: str | None
    acreage: float | None
    year_built: int | None
    city: str | None
    evac_zone: str | None
    subdivision: str | None


class ProgressOut(BaseModel):
    hash_code: str
    survey_complete: bool
    map_complete: bool


class SurveyIn(BaseModel):
    respondent_name: str | None = None
    respondent_email: str | None = None
    respondent_phone: str | None = None
    defensible_space: str | None = None
    ember_resistant_roof: str | None = None
    vegetation_clearance: str | None = None
    has_fire_plan: str | None = None
    has_go_bag: str | None = None
    water_source: str | None = None
    evacuation_route: str | None = None
    hoa_name: str | None = None
    wants_assessment: bool = False
    wants_firewise: bool = False
    wants_newsletter: bool = False
    concerns: str | None = None
    notes: str | None = None


class MapResultIn(BaseModel):
    zones_geojson: dict | None = None
    buildings_count: int | None = None
    plants_saved: dict | None = None


class HOAOut(BaseModel):
    hoa_name: str
    subdivision_name: str | None
    website: str | None
    phone: str | None


# ── Parcel search ────────────────────────────────────────────────────────────


@router.get("/parcels/search", response_model=list[ParcelOut])
async def search_parcels(
    address: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db),
):
    """Fuzzy search parcels by situs address using trigram similarity."""
    normalized = " ".join(address.upper().split())
    stmt = (
        select(Parcel)
        .where(
            or_(
                func.similarity(func.upper(Parcel.situs_address), normalized) > 0.15,
                func.upper(Parcel.situs_address).contains(normalized),
            )
        )
        .order_by(func.similarity(func.upper(Parcel.situs_address), normalized).desc())
        .limit(10)
    )
    result = await db.execute(stmt)
    return [ParcelOut.model_validate(row.__dict__) for row in result.scalars().all()]


@router.get("/parcels/{hash_code}", response_model=ParcelOut)
async def get_parcel(hash_code: str, db: AsyncSession = Depends(get_db)):
    """Look up a single parcel by hash code."""
    parcel = await db.get(Parcel, hash_code)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    return ParcelOut.model_validate(parcel.__dict__)


# ── Progress tracking ────────────────────────────────────────────────────────


@router.get("/progress/{hash_code}", response_model=ProgressOut)
async def get_progress(hash_code: str, db: AsyncSession = Depends(get_db)):
    """Check completion status for a parcel."""
    progress = await db.get(UserProgress, hash_code)
    if not progress:
        return ProgressOut(hash_code=hash_code, survey_complete=False, map_complete=False)
    return ProgressOut.model_validate(progress.__dict__)


async def _ensure_progress(hash_code: str, db: AsyncSession) -> UserProgress:
    """Get or create a UserProgress row for this hash_code."""
    progress = await db.get(UserProgress, hash_code)
    if not progress:
        progress = UserProgress(hash_code=hash_code)
        db.add(progress)
    return progress


# ── Survey ───────────────────────────────────────────────────────────────────


@router.get("/survey/{hash_code}", response_model=SurveyIn | None)
async def get_latest_survey(
    hash_code: str, db: AsyncSession = Depends(get_db),
):
    """Return the most recent survey response for a parcel, or null if none."""
    stmt = (
        select(SurveyResponse)
        .where(SurveyResponse.hash_code == hash_code)
        .order_by(SurveyResponse.responded_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    row = result.scalars().first()
    if not row:
        return None
    return SurveyIn.model_validate(row.__dict__)


@router.post("/survey/{hash_code}")
async def submit_survey(
    hash_code: str, body: SurveyIn, db: AsyncSession = Depends(get_db),
):
    """Submit a fire preparedness survey for a parcel."""
    parcel = await db.get(Parcel, hash_code)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    response = SurveyResponse(hash_code=hash_code, **body.model_dump())
    db.add(response)

    progress = await _ensure_progress(hash_code, db)
    progress.survey_complete = True

    await db.commit()

    return {
        "status": "ok",
        "survey_complete": True,
        "map_complete": progress.map_complete,
        "situs_address": parcel.situs_address,
    }


# ── Map results ──────────────────────────────────────────────────────────────


@router.post("/map-result/{hash_code}")
async def save_map_result(
    hash_code: str, body: MapResultIn, db: AsyncSession = Depends(get_db),
):
    """Save map/zone results and mark map as complete for a parcel."""
    parcel = await db.get(Parcel, hash_code)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    result = MapResult(hash_code=hash_code, **body.model_dump())
    db.add(result)

    progress = await _ensure_progress(hash_code, db)
    progress.map_complete = True

    await db.commit()

    return {
        "status": "ok",
        "map_complete": True,
        "survey_complete": progress.survey_complete,
        "situs_address": parcel.situs_address,
    }


# ── HOA list ─────────────────────────────────────────────────────────────────

# Static HOA list from AllClear data — loaded at startup
_HOA_LIST: list[dict] = []


def load_hoa_list(hoas: list[dict]) -> None:
    """Called at app startup to populate the HOA list from seed data."""
    _HOA_LIST.clear()
    _HOA_LIST.extend(hoas)


@router.get("/hoas", response_model=list[HOAOut])
async def list_hoas():
    """Return the list of known Ashland HOAs."""
    return _HOA_LIST
