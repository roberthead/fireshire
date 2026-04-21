# Story: Populate Plants by Fire Zone

## Summary

AS a homeowner viewing my property
ON the zones view
I WANT to add plants to a list for each of the four fire zones
SO THAT I can inventory what's growing in each zone and see an advisory suitability indicator for each plant

## Acceptance Criteria

### Core

- For a given property, the UI shows four zone sections (Zone 1, 2, 3, 4), each listing the plants currently recorded in that zone
- Zone sections are expanded by default
- Empty zones display an action-oriented prompt: "Add the first plant in Zone N"
- User can add a plant to a specific zone from an inline expanding input under that zone's "+ Add plant" control (no modal/sheet):
  - Typing queries the LWF/HIZ plant database
  - Results show common name + scientific name (italic, `lang="la"`) + zone-compatibility indicator
  - The last option is always "Add '[typed text]' as custom entry" for free-text
  - Free-text entries persist with `plant_id = null`
- Each plant row shows:
  - Plant name (common + scientific if from LWF)
  - Suitability badge combining color + icon + text: Compatible / Use caution / Not rated
  - **Ask Rascal** icon button (first-class, always visible on the row)
  - Move control: inline 4-chip zone picker (current zone disabled)
  - Delete icon
- Move action: tapping a zone chip PATCHes the entry's `zone` and the row relocates to the new section; suitability recomputes
- Delete action: immediate soft-delete with a 5-second undo toast (no inline confirmation)
- Ask Rascal: button opens the existing chat panel and focuses the input; in this story, **no context is pre-filled** — passing plant context is a follow-up story
- Plant entries are persisted to PostgreSQL, scoped to the property (taxlot ID)
- All visitors to the same address see the same entries (shared community data)
- Maximum 100 entries per zone per property; plant-name label is capped at 100 characters
- When the parcel has no detected buildings (no zones computed), the zone sections render in a disabled state with a "No buildings detected — zones unavailable" notice and a "Why am I seeing this?" explainer link

### Accessibility

- All interactions are fully keyboard-operable; tab order is documented per component
- Non-text state (zone identity, suitability) is conveyed by text + icon in addition to color
- `aria-live="polite"` region announces add, remove, move, and count changes (e.g., "Rosemary added to Zone 2; 4 plants in zone")
- Inline pickers and the undo toast manage focus: open moves focus to the relevant control; close returns focus to the triggering element
- Escape cancels the add combobox and collapses the move chip picker
- Touch targets are ≥44×44 px throughout
- Scientific names use `lang="la"` so screen readers don't mangle Latin
- Transitions respect `prefers-reduced-motion`
- The zones view must be axe-core clean

## Notes

- This is the first database table in the project — establishes the model/migration pattern
- Free-text entries enable marking non-plant features (compost piles, gravel paths, etc.) that are still zone-relevant
- This story is a predecessor to the photo identification story — photo ID is a fancier way to identify the plant before adding it to a zone
- No authentication or abuse prevention in V1; shared community data is acceptable for the hackathon scope
- No map pinning: plants are associated with a zone label, not coordinates. This keeps the UX simple and sidesteps point-in-polygon logic, clustering, and drag-to-move.
- The existing plant search panel is **merged** into this feature — there should be a single unified place to search plants + associate them with a zone. No parallel search entry points.

## Edge Cases & Design Decisions

- **LWF plant added to a zone it's not rated for:** Show "Use caution" badge + inline warning text; do not block — this is advisory software
- **Parcels with zero buildings (no zones):** Zone sections disabled; add controls non-interactive; explainer link visible
- **Duplicate entries:** Allowed. A homeowner may legitimately have multiple of the same plant in a zone. No de-duplication or unique constraint.
- **Concurrent edits:** Last write wins (acceptable for a small community hackathon tool)
- **TOCTOU race on the 100-per-zone cap:** Known limitation. Two concurrent POSTs can each observe 99 and both succeed, yielding 101. Documented; not solved in V1.
- **Soft-deleted entries do not count toward the per-zone cap.**
- **PATCH on a soft-deleted entry:** Returns 404 (the entry is not visible to the API).
- **Abuse guardrails:** Soft-delete (flag, don't remove); 100 per zone per property; label max 100 characters.
- **Future-proofing for photo ID story:** Include nullable `source` and `image_url` columns now to avoid a later migration.

## Open Design Questions

- **Panel placement is TBD.** Candidates: desktop right-side drawer beside the map; mobile bottom sheet with snap points. Should the map visually highlight a zone ring when its section is focused? Defer to design iteration; revisit before Increment 2 starts.

## Implementation Plan

### Pre-flight — Alembic Baseline Check (spike)

Before Increment 1b, confirm the existing `allclear` tables in the Neon DB are tracked in `alembic/versions/`. If not, running `--autogenerate` will try to re-create them. Likely needed:

- Inspect current `alembic/versions/` state
- If tables exist in DB but not in Alembic history, run `alembic stamp head` against the prod DB to establish a clean baseline before any autogenerate
- Decide the preview-environment DB strategy: shared Neon DB with prod (simple, hackathon-appropriate) vs. Neon branch per preview (cleaner isolation)

### Increment 1 — Database Model + CRUD API

#### 1a. Database Model

**New file:** `backend/app/models/plant_entry.py`

```python
class PlantEntry(Base):
    __tablename__ = "plant_entries"

    id: UUID (PK, default uuid4)
    taxlot_id: String(50), not null
    zone: String(20), not null  # CHECK: "0-5" | "5-10" | "10-30" | "30-100"
    plant_id: String(100), nullable  # LWF plant UUID when from catalog
    plant_name: String(100), not null  # denormalized — display doesn't depend on LWF API availability
    source: String(20), default "manual", not null  # CHECK: "manual" | "photo_id"
    image_url: Text, nullable  # unused in V1, populated by photo ID story
    notes: Text, nullable
    deleted_at: DateTime(tz), nullable  # soft delete
    created_at: DateTime(tz), server_default=now()
    updated_at: DateTime(tz), server_default=now(), onupdate=now()
```

- No spatial columns — plants are attached to a zone label, not a coordinate
- `taxlot_id` matches the `MAPLOT` values from Ashland GIS (e.g., `"391E09BC 3200"`)
- **Partial index** on `(taxlot_id, zone) WHERE deleted_at IS NULL` — covers the primary query pattern and excludes tombstones
- CHECK constraints on `zone` and `source` — bad data can't slip in via raw SQL
- No unique constraint — duplicate entries are deliberately allowed (comment in the model)

**Update:** `backend/app/models/__init__.py` — re-export `PlantEntry`

**Update:** `backend/alembic/env.py` — add `import app.models` so Alembic detects the model (AllClear models must remain importable from the same module)

#### 1b. Alembic Migration

```bash
cd backend
poetry run alembic revision --autogenerate -m "create plant_entries table"
# review generated migration — confirm it only adds plant_entries, doesn't re-create allclear tables
poetry run alembic upgrade head
```

#### 1c. CRUD Layer

**New file:** `backend/app/crud/plant_entries.py`

- `get_entries_by_taxlot(db, taxlot_id)` — `SELECT ... WHERE taxlot_id = ? AND deleted_at IS NULL ORDER BY zone, created_at`
- `create_entry(db, data)` — counts live entries in the target zone; if ≥ 100, raise `ZoneCapExceededError` (maps to 409); else insert + commit
- `update_entry(db, entry_id, data)` — `model_dump(exclude_unset=True)`; raises `EntryNotFoundError` if the row is missing **or** soft-deleted
- `delete_entry(db, entry_id)` — idempotent soft delete; sets `deleted_at = now()` if not already set
- Exception classes: `EntryNotFoundError`, `ZoneCapExceededError`

#### 1d. API Endpoints

**New file:** `backend/app/routers/plant_entries.py`

| Method | Path | Body/Params | Response | Status |
|--------|------|-------------|----------|--------|
| `GET` | `/plant-entries?taxlot_id=...` | query param (required) | response envelope matching existing routers (check `plants.py` / `parcels.py` for convention) | 200 |
| `POST` | `/plant-entries` | `PlantEntryCreate` | `PlantEntryResponse` | 201 |
| `PATCH` | `/plant-entries/{id}` | `PlantEntryUpdate` | `PlantEntryResponse` | 200 |
| `DELETE` | `/plant-entries/{id}` | — | — | 204 |

**Pydantic schemas** in `backend/app/routers/schemas/plant_entry.py` (single module — don't split per-verb unless the codebase already does):

- `PlantEntryCreate`: `taxlot_id`, `zone` (pattern `^(0-5|5-10|10-30|30-100)$`), `plant_id` (nullable), `plant_name` (1–100 chars), `notes` (optional)
- `PlantEntryUpdate`: `zone`, `plant_name`, `notes` — all optional, partial update. Deliberately omits `plant_id` (re-identifying a free-text entry as an LWF match is a V2 concern.)
- `PlantEntryResponse`: all fields, `model_config = {"from_attributes": True}`

**Register in `main.py`:** router + exception handlers (`EntryNotFoundError` → 404, `ZoneCapExceededError` → 409)

#### 1e. Deployment Prerequisites

- Provision a Postgres instance (Vercel Marketplace Neon recommended)
- Set `FIRESHIRE_DATABASE_URL` in Vercel env vars — confirm for all target environments (prod + preview at minimum)
- Promote `sqlalchemy`/`asyncpg` from optional to core dependencies; Alembic stays optional (migrations run out-of-band)
- Run `alembic upgrade head` as a **one-time manual migration** against the Neon URL from a developer machine — not a build step (Vercel builds shouldn't reach the prod DB)
- Update `scripts/validate.sh` so CI exercises model/router tests against a local Postgres

### Increment 2 — Zone Lists UI

This increment replaces the existing plant-search panel with the unified zone-lists panel. There is one plant search surface in the app, not two.

#### 2a. Frontend API Layer

**Edit:** `frontend/src/lib/api.ts`

- Add `PlantEntry` type matching backend response
- Add `fetchEntries(taxlotId)`, `createEntry(data)`, `updateEntry(id, data)`, `deleteEntry(id)`

#### 2b. Zone Lists Panel

**New file:** `frontend/src/components/ZonePlantLists.tsx` (replaces the current search panel — delete or fold its internals here)

- Four zone sections, expanded by default, each with: zone label + distance range (text, not color-only), count badge, entry list, "+ Add plant" control
- `useQuery` keyed on `taxlotId`; group entries by `zone` client-side
- Optimistic UI for add/move/delete with rollback + retry toast on failure
- `aria-live="polite"` region announces action completions and count updates
- Disabled state when no buildings detected, with "Why am I seeing this?" explainer link

#### 2c. Inline Add-Plant Combobox

**New file:** `frontend/src/components/AddPlantCombobox.tsx`

- No sheet/modal. Inline expanding input appears under the "+ Add plant" control
- Combobox ARIA pattern: `role="combobox"` + `aria-activedescendant`; arrow keys navigate, Enter commits, Escape collapses
- Results: LWF matches (reuse existing `plantSearch.ts`) with common + scientific (`lang="la"`) + per-target-zone compatibility indicator
- Last option is always "Add '[typed text]' as custom entry"
- Selecting commits via `createEntry` with the section's zone scope

#### 2d. Plant Entry Row

**New file:** `frontend/src/components/PlantEntryRow.tsx`

Row layout (right-aligned action strip, all ≥44px targets):

1. Plant name (common) + scientific (italic, `lang="la"`)
2. Suitability badge: color + icon + text ("Compatible" ✓ / "Use caution" ⚠ / "Not rated" ?)
3. **Ask Rascal** icon button (chat-bubble icon, tooltip "Ask Rascal about this plant") — first-class, always visible
4. Move control: 4 inline zone chips; current zone disabled; tap to PATCH `zone`
5. Delete icon

Zone mismatch shows inline warning text beneath the badge.

### Increment 3 — Delete + Undo Toast

- Delete icon → immediate soft-delete (no inline confirmation)
- Undo toast appears for 5 seconds with:
  - `role="status"` (not `role="alert"` — non-critical)
  - "Undo" button inside, keyboard reachable via Tab from the current focus position (focus is not stolen)
  - `aria-keyshortcuts="Alt+Z"` documented
  - Dismiss respects `prefers-reduced-motion`
- Undo action issues a PATCH clearing `deleted_at`

### Increment 4 — Ask Rascal Stub

**Edit:** `frontend/src/components/PlantEntryRow.tsx` + `frontend/src/components/ChatPanel.tsx`

- "Ask Rascal" opens the chat panel and focuses the input
- **No context pre-fill in this story** — cross-component context plumbing (plant name, zone, LWF data → chat pre-seed) is tracked as a follow-up story
- Document this limitation in the Notes section of the follow-up story when it's written

### Test Plan

**Backend tests:**

- `tests/test_plant_entry_crud.py`:
  - Create entry returns all fields; defaults populate (id, created_at, source)
  - List entries by taxlot_id excludes soft-deleted; ordered by zone then created_at
  - Update partial fields; changing `zone` is the move operation
  - Update on a soft-deleted entry raises `EntryNotFoundError`
  - Delete sets `deleted_at`; second delete is idempotent
  - 100-per-zone cap enforced on create; soft-deleted entries do not count toward the cap
  - `EntryNotFoundError` on missing ID

- `tests/test_plant_entry_router.py`:
  - POST valid entry → 201
  - POST with invalid zone string → 422
  - POST exceeding per-zone cap → 409
  - GET by taxlot_id → list of entries, soft-deleted excluded
  - PATCH zone change → updated zone + recomputed suitability
  - PATCH on soft-deleted → 404
  - DELETE → 204; subsequent GET excludes; repeat DELETE → 204 (idempotent)
  - 404 on nonexistent entry ID

**Frontend tests:**

- `ZonePlantLists.test.tsx`:
  - Renders four zone sections with correct counts; sections expanded by default
  - Empty zone shows action-oriented "Add the first plant in Zone N" prompt
  - Parcel with no buildings shows disabled state + explainer link
  - Entries are grouped into the correct section by `zone`
  - `aria-live` announcements fire on add / remove / move

- `AddPlantCombobox.test.tsx`:
  - Expands inline under the correct zone's "+ Add plant" control (not a modal)
  - Keyboard nav: arrow keys move `aria-activedescendant`, Enter commits, Escape collapses
  - LWF search filters results
  - Selecting an LWF plant calls `createEntry` with correct zone
  - No results shows "Add '[typed]' as custom entry" as the last option
  - Free-text entry creates an entry with `plant_id = null`
  - Focus returns to "+ Add plant" control on close

- `PlantEntryRow.test.tsx`:
  - Shows plant name, scientific name (with `lang="la"`), suitability badge (text + icon + color)
  - LWF plant shows scientific name; free-text shows "Not rated"
  - Zone mismatch shows "Use caution" badge + inline warning
  - "Ask Rascal" opens chat panel and focuses the input; no pre-fill in V1
  - Move chip PATCHes `zone`; row relocates to new section; current zone chip disabled
  - Delete soft-deletes immediately; undo toast appears with `role="status"` and reachable Undo button
  - Undo restores the entry (`deleted_at` cleared)

- **Accessibility tests:**
  - axe-core clean on the zones view
  - Full keyboard walkthrough of add → move → delete → undo without mouse

## Learnings

[to be filled in by Claude after implementation]
