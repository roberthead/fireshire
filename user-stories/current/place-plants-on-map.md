# Story: Track Plants Present in Each Fire Zone

## Summary

AS a homeowner viewing my property
ON the zones view
I WANT to add plants to a list for each of the four fire zones
SO THAT I can inventory what's growing in each zone and see whether each plant is appropriate for the zone it's in

## Acceptance Criteria

- For a given property, the UI shows four zone lists (Zone 1, 2, 3, 4), each displaying the plants currently recorded in that zone
- User can add a plant to any specific zone by:
  - Selecting the zone
  - Searching the LWF/HIZ plant database, OR
  - Entering a free-text name (e.g., "compost pile", "unknown shrub")
- Each plant entry in a zone list shows:
  - Plant name (common + scientific if from LWF)
  - Fire-zone suitability indicator (compatible / use caution / not rated)
  - "Ask Rascal about this plant" action that opens chat pre-seeded with plant name, zone, and suitability context
- User can remove a plant from a zone
- User can move a plant from one zone to another (e.g., "I put this in Zone 2, not Zone 3")
- Zone lists are persisted to PostgreSQL, scoped to the property (taxlot ID)
- All visitors to the same address see the same zone lists (shared community data)
- Empty zones display a friendly prompt: "No plants recorded in Zone N yet"

## Notes

- This is the first database table in the project — establishes the model/migration pattern
- Free-text entries enable marking non-plant features (compost piles, gravel paths, etc.) that are still zone-relevant
- This story is a predecessor to the photo identification story — photo ID is a fancier way to identify the plant before adding it to a zone
- No authentication or abuse prevention in V1
- No map pinning: plants are associated with a zone, not a lat/lng point. This keeps the UX simple and sidesteps point-in-polygon logic, clustering, and drag-to-move interactions.

## Edge Cases & Design Decisions

- **LWF plant added to a zone it's not rated for:** Show informational warning, not a block — this is advisory software
- **Parcels with zero buildings (no zones):** Show notice "No buildings detected — zones unavailable"; disable the add-plant controls
- **Duplicate entries:** Allowed — a homeowner may legitimately have multiple of the same plant in a zone. No de-duplication.
- **Concurrent edits:** Last write wins (acceptable for a small community hackathon tool)
- **Abuse guardrails:** Soft-delete entries (flag, don't remove); cap at 100 plants per zone per property; label max 100 characters
- **Future-proofing for photo ID story:** Include nullable `source` and `image_url` columns now to avoid a migration later

## Implementation Plan

### Increment 1 — Database Model + CRUD API

#### 1a. Database Model

**New file:** `backend/app/models/plant_entry.py`

```python
class PlantEntry(Base):
    __tablename__ = "plant_entries"

    id: UUID (PK, default uuid4)
    taxlot_id: String(50), not null, indexed
    zone: String(20), not null  # "0-5", "5-10", "10-30", "30-100"
    plant_id: String(100), nullable  # LWF plant UUID when from catalog
    plant_name: Text, not null  # denormalized — display doesn't depend on LWF API availability
    source: String(20), default "manual"  # "manual" now, "photo_id" later
    image_url: Text, nullable  # unused in V1, populated by photo ID story
    notes: Text, nullable
    deleted_at: DateTime(tz), nullable  # soft delete
    created_at: DateTime(tz), server_default=now()
    updated_at: DateTime(tz), server_default=now(), onupdate=now()
```

- No spatial columns — plants are attached to a zone label, not a coordinate
- `taxlot_id` matches the `MAPLOT` values from Ashland GIS (e.g., `"391E09BC 3200"`)
- Composite index on `(taxlot_id, zone)` covers the primary query pattern (fetch all plants for a property, grouped by zone)

**Update:** `backend/app/models/__init__.py` — re-export `PlantEntry`

**Update:** `backend/alembic/env.py` — add `import app.models` so Alembic detects the model

#### 1b. Alembic Migration

```bash
cd backend
poetry run alembic revision --autogenerate -m "create plant_entries table"
# review the generated migration
poetry run alembic upgrade head
```

#### 1c. CRUD Layer

**New file:** `backend/app/crud/plant_entries.py`

- `get_entries_by_taxlot(db, taxlot_id)` — `SELECT ... WHERE taxlot_id = ? AND deleted_at IS NULL ORDER BY zone, created_at`
- `create_entry(db, data)` — validate per-zone count < 100, insert, commit, return
- `update_entry(db, entry_id, data)` — `model_dump(exclude_unset=True)` for partial updates (move between zones = update `zone`)
- `delete_entry(db, entry_id)` — set `deleted_at = now()` (soft delete)
- `EntryNotFoundError` exception class

#### 1d. API Endpoints

**New file:** `backend/app/routers/plant_entries.py`

| Method | Path | Body/Params | Response | Status |
|--------|------|-------------|----------|--------|
| `GET` | `/plant-entries?taxlot_id=...` | query param (required) | `{"entries": [...]}` grouped-ready (flat list, client groups by zone) | 200 |
| `POST` | `/plant-entries` | `PlantEntryCreate` | `PlantEntryResponse` | 201 |
| `PATCH` | `/plant-entries/{id}` | `PlantEntryUpdate` | `PlantEntryResponse` | 200 |
| `DELETE` | `/plant-entries/{id}` | — | 204 No Content | 204 |

**Pydantic schemas** in `backend/app/routers/schemas/plant_entry.py`:

- `PlantEntryCreate`: taxlot_id, zone (validated enum), plant_id (nullable), plant_name (1–100 chars), notes (optional)
- `PlantEntryUpdate`: zone, plant_name, notes — all optional, partial update (move = change `zone`)
- `PlantEntryResponse`: all fields, `model_config = {"from_attributes": True}`
- Zone validated with pattern: `^(0-5|5-10|10-30|30-100)$`

**Register in `main.py`:** router + `EntryNotFoundError` → 404 handler

#### 1e. Deployment Prerequisites

- Provision a Postgres instance (Vercel Marketplace Neon or external)
- Set `FIRESHIRE_DATABASE_URL` in Vercel env vars
- Move `sqlalchemy`/`asyncpg` from optional to core dependencies
- Run `alembic upgrade head` as build step or one-time migration

### Increment 2 — Zone Lists UI + Add Plant

#### 2a. Frontend API Layer

**Edit:** `frontend/src/lib/api.ts`

- Add `PlantEntry` type matching backend response
- Add `fetchEntries(taxlotId: string)` — GET
- Add `createEntry(data)` — POST
- Add `updateEntry(id, data)` — PATCH
- Add `deleteEntry(id)` — DELETE

#### 2b. Zone Lists Panel

**New file:** `frontend/src/components/ZonePlantLists.tsx`

- Panel with four collapsible sections, one per zone, color-matched to the map overlay
- Each section header: zone name, distance range, count badge ("3 plants")
- Section body: list of plant entries, or empty-state prompt
- "+ Add plant" button at the bottom of each zone section
- Fetch via `useQuery` keyed on `taxlotId`; group entries by `zone` client-side
- Optimistic UI on add/remove/move — entry appears/disappears immediately, persists in background
- Disabled state with notice when parcel has no buildings (no zones computed)

#### 2c. Add Plant Flow

**New file:** `frontend/src/components/AddPlantSheet.tsx`

- Triggered by "+ Add plant" in a zone section — sheet/modal pre-scoped to that zone
- Search input that queries loaded LWF plant data (reuse existing `plantSearch.ts` logic)
- Results list: common name + scientific name (italic) + zone compatibility dot (is this plant rated for the target zone?)
- No matches → "Add '[typed text]' as custom entry" option with "+" icon
- Selecting a plant or free-text entry calls `createEntry`, closes sheet

### Increment 3 — Entry Detail + Move + Delete

#### 3a. Entry Row Interactions

**New file:** `frontend/src/components/PlantEntryRow.tsx`

- Each row shows: plant name, scientific name (if LWF), suitability badge, overflow menu
- Overflow menu actions:
  - "Ask Rascal about this plant" — opens chat pre-filled (see Increment 4)
  - "Move to another zone" — opens zone picker (radio list of the four zones), selecting issues a PATCH with new `zone`
  - "Remove" — inline confirmation, soft delete with 5-second undo toast
- Zone-mismatch warning inline: "Not typically recommended for Zone X"
- Click row to expand details (LWF family, attributes) if available

#### 3b. Move Between Zones

- Via the "Move to another zone" menu action — no drag-and-drop in V1
- On confirm: PATCH updates `zone`, list re-groups on refetch / optimistic update
- Suitability badge recomputes for the new zone

### Increment 4 — Rascal Integration

#### 4a. Pre-seeded Chat Context

**Edit:** `frontend/src/components/PlantEntryRow.tsx` + `frontend/src/components/ChatPanel.tsx`

- "Ask Rascal" passes context to ChatPanel via shared state or callback:
  - Plant name, zone, distance range, address, LWF suitability data
- ChatPanel receives pre-fill text, places it in the input field (not auto-sent — user can edit)
- Default pre-fill: "I have [plant name] in Zone [N] ([distance range]) on my property at [address]. Is this a good fit for fire resilience?"
- Works for both LWF plants and free-text entries (Rascal can give general fire-resilience advice for "compost pile")

### Test Plan

**Backend tests:**

- `tests/test_plant_entry_model.py`:
  - Model creates with all fields, defaults work (id, created_at, source)
  - Soft delete sets deleted_at, doesn't remove row

- `tests/test_plant_entry_crud.py`:
  - Create entry, verify returned fields
  - List entries by taxlot_id, excludes soft-deleted, ordered by zone then created_at
  - Update partial fields (move: zone only)
  - Delete sets deleted_at
  - EntryNotFoundError on missing ID
  - 100-per-zone cap enforced on create

- `tests/test_plant_entry_router.py`:
  - POST valid entry → 201
  - POST with invalid zone string → 422
  - POST exceeding per-zone cap → 400
  - GET by taxlot_id → list of entries
  - PATCH zone change → updated zone
  - DELETE → 204, subsequent GET excludes it
  - 404 on nonexistent entry ID

**Frontend tests:**

- `ZonePlantLists.test.tsx`:
  - Renders four zone sections with correct counts
  - Empty zone shows empty-state prompt
  - Parcel with no buildings shows disabled notice
  - Entries are grouped into the correct section by `zone`

- `AddPlantSheet.test.tsx`:
  - Sheet opens pre-scoped to the zone it was triggered from
  - Search filters LWF plants by text
  - Selecting a plant calls `createEntry` with correct zone
  - No results shows free-text entry option
  - Free-text entry creates entry with null `plant_id`

- `PlantEntryRow.test.tsx`:
  - Shows plant name, suitability badge
  - LWF plant shows scientific name
  - Free-text shows "Not rated"
  - Zone mismatch shows warning
  - "Ask Rascal" triggers chat pre-fill with correct context
  - "Move to another zone" PATCHes `zone` field
  - Remove shows inline confirmation, then soft deletes
  - Undo toast restores entry

## Learnings

[to be filled in by Claude after implementation]
