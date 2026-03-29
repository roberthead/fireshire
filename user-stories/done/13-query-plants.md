# Query plants database

AS a user
WHEN I have an address selected
AND I have at least one zone active
I WANT a panel on the right side to display a list of plants that are appropriate to the selected zones

## Plants API

### Endpoints

GET /api/v2/docs-raw — Full OpenAPI 3.0 spec as JSON
GET /plant-fields.json — Every field, attribute, and allowed value with descriptions
GET /api/v2/plants?includeImages=true — Browse all 1,361 plants as JSON
GET /api/v2/attributes/hierarchical — Full attribute tree with allowed values
GET /api/v2/plants/1b78126d-... — Test plant (Glossy abelia) with all values + images

Described here:
https://lwf-api.vercel.app/

## Implementation Plan

### Key API Discovery

The Living with Fire (LWF) plants API at `lwf-api.vercel.app` exposes a **Home Ignition Zone (HIZ)** attribute (ID: `b908b170-70c9-454d-a2ed-d86f98cb3de1`) under the Flammability category. Each plant can belong to multiple zones via multi-select values:

| rawValue | displayName | FireShire Zone |
|----------|-------------|----------------|
| `01`     | 0-5         | Zone 1 (Red)   |
| `02`     | 5-10        | Zone 2 (Orange)|
| `03`     | 10-30       | Zone 3 (Yellow)|
| `04`     | 30-100      | Zone 4 (Green) |
| `05`     | 50-100      | (Idaho-specific, subset of Zone 4) |

Query: `GET /api/v2/plants?attributeIds=b908b170-70c9-454d-a2ed-d86f98cb3de1&includeImages=true` returns all 1,361 plants with their HIZ values and primary images. Response shape: `{ data: Plant[], meta: { pagination: { total, limit, offset, hasMore } } }`. Each plant has `values[]` entries with `resolved.value` giving the display name (e.g. "10-30").

### Architecture Decisions

1. **Backend proxy** — Add a `/plants` endpoint in FastAPI that proxies to `lwf-api.vercel.app/api/v2/plants`. This follows the existing pattern (parcels, buildings) and avoids CORS issues. The proxy passes through query params and returns the LWF response as-is.

2. **Frontend filtering** — Fetch plants once per parcel selection (they don't change by address). Filter client-side by matching each plant's HIZ `resolved.value` against the currently visible zones from `MapContext.zoneVisibility`.

3. **Right-side panel** — A new `PlantPanel` component positioned as `overlay-right` on desktop (scrollable, frosted glass style matching existing overlays). On mobile, it flows below the map as a collapsible section.

---

### Step 1: Backend — `/plants` proxy endpoint

**File: `backend/app/routers/plants.py`** (new)

- Create a FastAPI router with `GET /plants`
- Accept query params: `zones` (comma-separated zone display names, e.g. "0-5,10-30"), `limit` (default 50), `offset` (default 0), `search` (optional text)
- Proxy to `GET https://lwf-api.vercel.app/api/v2/plants` with:
  - `attributeIds=b908b170-70c9-454d-a2ed-d86f98cb3de1` (always include HIZ values)
  - `includeImages=true`
  - Pass through `limit`, `offset`, `search` if provided
- Use `httpx.AsyncClient` (new instance — not `gis_client`, since this is a different upstream)
- Return the LWF response JSON directly (no transformation needed)
- Handle errors: timeout → 503, upstream 4xx/5xx → pass through status

**File: `backend/app/main.py`** — Register: `app.include_router(plants.router)`

**File: `backend/tests/test_plants.py`** (new)

- Mock the upstream LWF API with `respx`
- Test: valid request proxies correctly with expected params
- Test: upstream timeout returns 503
- Test: search param is forwarded
- Test: pagination params are forwarded

### Step 2: Frontend — API client + types

**File: `frontend/src/lib/api.ts`** — Add types and fetch function:

```typescript
interface PlantImage {
  id: string
  url: string
  caption: string | null
}

interface PlantValue {
  attributeId: string
  attributeName: string
  rawValue: string
  resolved: { value: string; type: string; id: string }
}

interface Plant {
  id: string
  genus: string
  species: string
  commonName: string
  primaryImage: PlantImage | null
  values: PlantValue[]
}

interface PlantResponse {
  data: Plant[]
  meta: { pagination: { total: number; limit: number; offset: number; hasMore: boolean } }
}
```

- `fetchPlants(zones: string[], search?: string, limit?: number, offset?: number)` → `GET /api/plants?zones=0-5,10-30&includeImages=true&limit=50&offset=0`
- Same error handling pattern as `fetchParcels`/`fetchBuildings`

### Step 3: Frontend — Helper to map zone visibility → zone display names

**File: `frontend/src/lib/zoneDisplayNames.ts`** (new)

```typescript
const ZONE_TO_DISPLAY: Record<string, string> = {
  zone1: '0-5',
  zone2: '5-10',
  zone3: '10-30',
  zone4: '30-100',
}

export function activeZoneDisplayNames(visibility: Record<string, boolean>): string[] {
  return Object.entries(visibility)
    .filter(([, visible]) => visible)
    .map(([id]) => ZONE_TO_DISPLAY[id])
    .filter(Boolean)
}
```

**Test file: `frontend/src/lib/zoneDisplayNames.test.ts`** — Unit tests for the mapping.

### Step 4: Frontend — `PlantPanel` component

**File: `frontend/src/components/PlantPanel.tsx`** (new)

- Accepts props: `zones: string[]` (active zone display names from helper)
- Uses `useQuery(['plants', zones], () => fetchPlants(zones))` — re-fetches when active zones change
- **Layout:**
  - Frosted glass panel (same `rgba(0,0,0,0.55)` + `backdrop-filter: blur(12px)` as other overlays)
  - Header: "Recommended Plants" with count badge and close button
  - Scrollable list body (`max-height: 60vh`, `overflow-y: auto`)
  - Each plant card shows: primary image thumbnail (48×48, rounded), common name (bold), scientific name (italic genus + species), zone badges (colored pills matching zone colors)
- **States:**
  - Loading: skeleton/spinner
  - Error: StatusBanner with retry
  - Empty: "No plants found for the active zones"
  - Data: scrollable plant list
- **Zone badges:** Small colored pills showing which zones each plant belongs to, using the same zone colors from `ZoneLegend`
- **Filtering:** Client-side filter plants whose HIZ `resolved.value` matches any active zone display name. A plant appears if it has at least one matching zone value.

**Test file: `frontend/src/components/PlantPanel.test.tsx`** — Tests:
- Renders plant list when data is loaded
- Shows loading state
- Shows empty state when no plants match
- Filters plants by active zones
- Displays zone badges with correct colors

### Step 5: Frontend — Wire into `index.tsx`

**File: `frontend/src/routes/index.tsx`**

- Import `PlantPanel` and `activeZoneDisplayNames`
- Read `zoneVisibility` from `MapContext` (will need to lift it or use the hook inside a child component)
- Render `PlantPanel` in a new `overlay-right` div, conditionally shown when `selectedParcel` exists and at least one zone is visible
- Pass `zones={activeZoneDisplayNames(zoneVisibility)}` to `PlantPanel`

### Step 6: Frontend — CSS for right panel + responsive layout

**File: `frontend/src/index.css`**

- Add `.overlay-right` positioning class:
  - Desktop: `position: absolute; top: var(--space-4); right: var(--space-4); width: 320px; max-height: calc(100vh - 120px); z-index: 1;`
  - Tablet (≤768px): `position: static; width: 100%; max-height: 40vh;`
  - Mobile (≤480px): collapsible with toggle button (like ZoneLegend pattern)
- Move `.overlay-bottom-right` (ZoneLegend) left or adjust so it doesn't collide with the plant panel

### Step 7: Validate

- Run `./scripts/validate.sh` (backend tests, frontend tests, types, lint)
- Manual: search an Ashland address → verify plants appear → toggle zones off → verify list updates

---

### Test Plan Summary

| Layer | What | How |
|-------|------|-----|
| Backend unit | Proxy forwards params, handles errors | pytest + respx mocks |
| Frontend unit | Zone name mapping | Vitest |
| Frontend unit | PlantPanel rendering, filtering, states | Vitest + Testing Library |
| Frontend unit | fetchPlants API client | Vitest with fetch mock |
| Integration | Full flow: address → zones → plants | Manual via dev servers |

## Learnings

### LWF Plants API
- The HIZ attribute ID `b908b170-70c9-454d-a2ed-d86f98cb3de1` is the key to mapping plants → fire zones. Always request it via `attributeIds` param.
- Plants are multi-zone — a single plant can appear in multiple HIZ zones. Filter with "any match" logic, not "exact match".
- Use `resolved.value` (e.g. `"10-30"`) for display names, NOT `rawValue` (e.g. `"03"`) which is an opaque ID.
- The `05` / `"50-100"` value is Idaho-specific and a subset of Zone 4 — treat it as Zone 4 if needed.
- Response pagination uses `{ data, meta: { pagination: { total, limit, offset, hasMore } } }` — standard offset-based.

### Backend Proxy Pattern
- When proxying a non-GIS upstream, create a separate httpx client (don't reuse `gis_client`) with its own error type. This keeps error handling clean — `PlantsApiError` vs `GISServiceError` map to different 503 error codes in the response.
- The LWF API doesn't need retries or exponential backoff (it's a Vercel-hosted app, not flaky GIS infrastructure), so the plants client is simpler than `gis_client`.

### Frontend Architecture
- Components that need `MapContext` data but are rendered inside `<MapProvider>` at the page level need a connector pattern — a small wrapper component that calls `useMapContext()` and passes data as props to the pure component. This keeps the pure component testable without mocking context.
- `PlantPanelConnector` in `index.tsx` bridges context → props for `PlantPanel`, which only receives `zones: string[]` and `onClose`.
