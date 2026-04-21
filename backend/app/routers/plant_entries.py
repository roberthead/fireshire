"""Plant entry endpoints — list/create/update/soft-delete scoped by taxlot."""

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import plant_entries as crud
from app.database import get_db
from app.routers.schemas.plant_entry import (
    PlantEntryCreate,
    PlantEntryResponse,
    PlantEntryUpdate,
)

router = APIRouter(prefix="/plant-entries", tags=["plant-entries"])


@router.get("")
async def list_entries(
    taxlot_id: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    entries = await crud.get_entries_by_taxlot(db, taxlot_id)
    return {"entries": [PlantEntryResponse.model_validate(e) for e in entries]}


@router.post("", response_model=PlantEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_entry(
    body: PlantEntryCreate,
    db: AsyncSession = Depends(get_db),
):
    entry = await crud.create_entry(db, body.model_dump())
    return PlantEntryResponse.model_validate(entry)


@router.patch("/{entry_id}", response_model=PlantEntryResponse)
async def update_entry(
    entry_id: uuid.UUID,
    body: PlantEntryUpdate,
    db: AsyncSession = Depends(get_db),
):
    entry = await crud.update_entry(db, entry_id, body.model_dump(exclude_unset=True))
    return PlantEntryResponse.model_validate(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    await crud.delete_entry(db, entry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
