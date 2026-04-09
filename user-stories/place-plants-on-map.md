# Story: Place and Manage Plants on the Property Map

## Summary

AS a homeowner viewing my property
ON the map view
I WANT to click a location on my property map, search for or name a plant, and place a pin there
SO THAT I can inventory what's growing on my property and see whether each plant is appropriate for its fire zone

## Acceptance Criteria

- User can click a location on the map to begin placing a plant
- Click determines the fire zone automatically based on the zone overlay geometry
- User can search the LWF/HIZ plant database to select a known plant
- If the plant isn't found in LWF, user can enter a free-text name (e.g., "compost pile", "unknown shrub")
- A pin is placed on the map at the clicked location
- Pins are only visible at sufficient zoom levels to avoid clutter
- Clicking a pin opens a detail panel showing:
  - Plant name (common + scientific if from LWF)
  - Zone the plant is in (e.g., "Zone 3: 10–30 ft")
  - Fire-zone suitability from LWF data (if available)
  - For free-text entries: zone info but no plant-specific fire advice
  - "Ask Rascal about this plant" button that opens chat pre-seeded with plant name, zone, and suitability context
- User can move a pin to a new location (which may change its zone)
- User can delete a pin
- Plant placements are persisted to PostgreSQL, scoped to the property (taxlot ID)
- All visitors to the same address see the same pins (shared community data)

## Notes

- This is the first database table in the project — establishes the model/migration pattern
- Free-text entries enable marking non-plant features (compost piles, gravel paths, etc.) that are still zone-relevant
- This story is a predecessor to the photo identification story — photo ID is just a fancier way to identify the plant before placing it
- No authentication or abuse prevention in V1

## Edge Cases & Design Decisions

- **Click inside a building footprint:** Reject with message "Plants can't be placed inside buildings"
- **Click outside parcel boundary:** Reject with message "Place plants within your property boundary"
- **Click beyond all zones (>100ft but inside parcel):** Allow, zone = `"outside"`
- **Pin at zone boundary:** Use the innermost (most restrictive) zone
- **Overlapping zones from multiple buildings:** Use the innermost zone
- **LWF plant placed in a zone it's not rated for:** Show informational warning, not a block — this is advisory software
- **Parcels with zero buildings:** Pins can be placed but no zone data; show notice "No buildings detected — zones unavailable"
- **Concurrent edits:** Last write wins (acceptable for a small community hackathon tool)
- **Abuse guardrails:** Soft-delete pins (flag, don't remove); cap at 200 pins per property; label max 100 characters
- **Future-proofing for photo ID story:** Include nullable `source` and `image_url` columns now to avoid a migration later

## Implementation Plan

### Increment 1 — Database Model + CRUD API

#### 1a. Database Model

**New file:** `backend/app/models/plant_placement.py`

```python
class PlantPlacement(Base):
    __tablename__ = "plant_placements"

    id: UUID (PK, default uuid4)
    taxlot_id: String(50), not null, indexed
    lat: Float, not null
    lng: Float, not null
    zone: String(20), not null  # "0-5", "5-10", "10-30", "30-100", "outside"
    plant_id: String(100), nullable  # LWF plant UUID when from catalog
    plant_name: Text, not null  # denormalized — display doesn't depend on LWF API availability
    source: String(20), default "manual"  # "manual" now, "photo_id" later
    image_url: Text, nullable  # unused in V1, populated by photo ID story
    notes: Text, nullable
    deleted_at: DateTime(tz), nullable  # soft delete
    created_at: DateTime(tz), server_default=now()
    updated_at: DateTime(tz), server_default=now(), onupdate=now()
```

- No PostGIS — all spatial logic stays client-side in Turf.js
- `taxlot_id` matches the `MAPLOT` values from Ashland GIS (e.g., `"391E09BC 3200"`)
- Single B-tree index on `taxlot_id` covers the primary query pattern

**Update:** `backend/app/models/__init__.py` — re-export `PlantPlacement`

**Update:** `backend/alembic/env.py` — add `import app.models` so Alembic detects the model

#### 1b. Alembic Migration

```bash
cd backend
poetry run alembic revision --autogenerate -m "create plant_placements table"
# review the generated migration
poetry run alembic upgrade head
```

#### 1c. CRUD Layer

**New file:** `backend/app/crud/plant_placements.py`

- `get_placements_by_taxlot(db, taxlot_id)` — `SELECT ... WHERE taxlot_id = ? AND deleted_at IS NULL ORDER BY created_at`
- `create_placement(db, data)` — validate pin count < 200 for the taxlot, insert, commit, return
- `update_placement(db, placement_id, data)` — `model_dump(exclude_unset=True)` for partial updates (move = update lat/lng/zone)
- `delete_placement(db, placement_id)` — set `deleted_at = now()` (soft delete)
- `PlacementNotFoundError` exception class

#### 1d. API Endpoints

**New file:** `backend/app/routers/plant_placements.py`

| Method | Path | Body/Params | Response | Status |
|--------|------|-------------|----------|--------|
| `GET` | `/plant-placements?taxlot_id=...` | query param (required) | `{"placements": [...]}` | 200 |
| `POST` | `/plant-placements` | `PlantPlacementCreate` | `PlantPlacementResponse` | 201 |
| `PATCH` | `/plant-placements/{id}` | `PlantPlacementUpdate` | `PlantPlacementResponse` | 200 |
| `DELETE` | `/plant-placements/{id}` | — | 204 No Content | 204 |

**Pydantic schemas** in `backend/app/routers/schemas/plant_placement.py`:
- `PlantPlacementCreate`: taxlot_id, lat, lng, zone (validated enum), plant_id (nullable), plant_name (1–100 chars)
- `PlantPlacementUpdate`: lat, lng, zone, plant_name — all optional, partial update
- `PlantPlacementResponse`: all fields, `model_config = {"from_attributes": True}`
- Zone validated with pattern: `^(0-5|5-10|10-30|30-100|outside)$`

**Register in `main.py`:** router + `PlacementNotFoundError` → 404 handler

#### 1e. Deployment Prerequisites

- Provision a Postgres instance (Vercel Marketplace Neon or external)
- Set `FIRESHIRE_DATABASE_URL` in Vercel env vars
- Move `sqlalchemy`/`asyncpg` from optional to core dependencies
- Run `alembic upgrade head` as build step or one-time migration

### Increment 2 — Click-to-Place + Display Pins on Map

#### 2a. Frontend API Layer

**Edit:** `frontend/src/lib/api.ts`

- Add `PlantPlacement` type matching backend response
- Add `fetchPlacements(taxlotId: string)` — GET
- Add `createPlacement(data)` — POST
- Add `updatePlacement(id, data)` — PATCH
- Add `deletePlacement(id)` — DELETE

#### 2b. Placement Mode + Map Interaction

**New file:** `frontend/src/components/PlantPlacementManager.tsx`

- "Add Plant" floating action button (bottom-right of map, dark glass styling, leaf icon)
- Click toggles **placement mode**:
  - Cursor changes to `crosshair`
  - Top banner: "Tap the map to place a plant" with "Cancel" button
  - Map click handler captures lat/lng coordinates
  - Zone auto-determined via Turf.js `booleanPointInPolygon` against computed zone rings
  - Reject clicks inside buildings or outside parcel boundary
- On valid click: temporary pin appears, **plant search sheet** opens

#### 2c. Plant Search Sheet

**New file:** `frontend/src/components/PlantSearchSheet.tsx`

- Bottom-center panel (360px wide on desktop, full-width bottom sheet on mobile)
- Search input that queries loaded LWF plant data (reuse existing `plantSearch.ts` logic)
- Results list: common name + scientific name (italic) + zone compatibility dot
- No matches → "Add '[typed text]' as custom entry" option with "+" icon
- Selecting a plant or free-text entry confirms placement, closes sheet, persists pin

#### 2d. Pin Rendering on Map

**New file:** `frontend/src/components/PlantPins.tsx`

- Fetch placements via `useQuery` keyed on `taxlotId`
- Render as Mapbox GL markers (DOM elements, not symbol layers — supports click events and drag)
- Pin appearance: teardrop shape, colored by zone (red/orange/yellow/green/gray), leaf icon center
- **Zoom thresholds:** full pins at zoom ≥ 15, smaller dots at 13–14, hidden below 13
- **Clustering:** when 3+ pins overlap within 40px, collapse into a numbered cluster circle; click cluster to zoom in
- **Optimistic UI:** pin appears immediately on placement, persists in background

### Increment 3 — Pin Detail + Move + Delete

#### 3a. Pin Detail Panel

**New file:** `frontend/src/components/PlantPinDetail.tsx`

- Click a pin → floating popover above the pin (desktop) or bottom sheet (mobile <768px)
- Content:
  - Plant name (header) + close button
  - Zone compatibility badge (zone color, "Compatible" / "Use caution" / "Not rated" for free-text)
  - Scientific name, family (if from LWF)
  - LWF plant attributes if available
  - For zone mismatches: "This plant is not typically recommended for Zone X. Consider moving it or consulting Rascal."
- Action buttons:
  - "Ask Rascal about this plant" — closes popover, switches to Chat tab, pre-fills input with: "I have [plant name] placed in Zone [N] ([distance range]) on my property at [address]. Is this a good placement for fire resilience?"
  - "Move plant" — enters move mode (see below)
  - "Remove plant" — inline confirmation ("Remove [name]?" with Cancel/Remove buttons), then soft delete with 5-second undo toast
- `role="dialog"`, `aria-label`, focus trap, Escape to close

#### 3b. Move Pin

- **Desktop:** pins are `draggable: true` — drag lifts pin (scale up, deeper shadow), drop persists new position + recomputed zone via PATCH
- **Mobile:** "Move plant" button enters move mode — banner "Tap new location for [name]", tap to move, pin animates to new position
- Zone recalculates on move; pin color updates if zone changes

### Increment 4 — Rascal Integration

#### 4a. Pre-seeded Chat Context

**Edit:** `frontend/src/components/PlantPinDetail.tsx` + `frontend/src/components/ChatPanel.tsx`

- "Ask Rascal" button passes context to ChatPanel via shared state or callback:
  - Plant name, zone, distance range, address, LWF suitability data
- ChatPanel receives pre-fill text, places it in the input field (not auto-sent — user can edit)
- Works for both LWF plants and free-text entries (Rascal can give general fire-resilience advice for "compost pile")

### Test Plan

**Backend tests:**

- `tests/test_plant_placement_model.py`:
  - Model creates with all fields, defaults work (id, created_at, source)
  - Soft delete sets deleted_at, doesn't remove row

- `tests/test_plant_placement_crud.py`:
  - Create placement, verify returned fields
  - List placements by taxlot_id, excludes soft-deleted
  - Update partial fields (move: lat/lng/zone only)
  - Delete sets deleted_at
  - PlacementNotFoundError on missing ID
  - 200-pin cap enforced on create

- `tests/test_plant_placement_router.py`:
  - POST valid placement → 201
  - POST with invalid zone string → 422
  - POST inside building / outside parcel → 400
  - POST exceeding 200-pin cap → 400
  - GET by taxlot_id → list of placements
  - PATCH move → updated lat/lng/zone
  - DELETE → 204, subsequent GET excludes it
  - 404 on nonexistent placement ID

**Frontend tests:**

- `PlantPlacementManager.test.tsx`:
  - "Add Plant" button enters placement mode (crosshair cursor, banner visible)
  - Cancel exits placement mode
  - Map click in valid zone opens search sheet
  - Map click inside building shows rejection message
  - Map click outside parcel shows rejection message

- `PlantSearchSheet.test.tsx`:
  - Search filters LWF plants by text
  - Selecting a plant calls create API
  - No results shows free-text entry option
  - Free-text entry creates placement with null plant_id

- `PlantPins.test.tsx`:
  - Renders pins for placement data
  - Pins hidden below zoom 13

- `PlantPinDetail.test.tsx`:
  - Shows plant name, zone badge, suitability info
  - LWF plant shows scientific name and attributes
  - Free-text shows "Not rated"
  - Zone mismatch shows warning
  - "Ask Rascal" triggers chat pre-fill
  - Delete shows inline confirmation, then soft deletes
  - Undo toast restores pin

## Learnings

[to be filled in by Claude after implementation]
