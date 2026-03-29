# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FireShire** is a fire-resilient landscaping zone visualizer built for the Ashland Fire-Resilient Landscaping Hackathon (White Rabbit co-working community, Ashland, OR). It accepts a property address, displays a satellite overhead view, and overlays color-coded buffer zones around detected building structures based on CAL FIRE / IBHS "Home Ignition Zone" distance bands.

## Architecture

### Backend — Python
- **Framework:** FastAPI
- **Database:** PostgreSQL
- **Database migrations:** Alembic
- **Tests:** pytest

### Frontend — TypeScript/React
- **Framework:** React with TanStack (Router, Query)
- **Build:** Vite
- **Tests:** Vitest
- **Map:** Mapbox GL JS (satellite basemap) with Leaflet as fallback
- **Geometry:** Turf.js for client-side buffer/difference operations on building polygons

### Data Source — Ashland GIS (ArcGIS Enterprise)
All spatial data comes from the City of Ashland's public ArcGIS REST services at `gis.ashland.or.us`. No authentication required.

- **Taxlots FeatureServer** — address lookup, parcel boundaries: `/arcgis/rest/services/taxlots/FeatureServer/0/query` (supports `f=geojson`)
- **Buildings MapServer** — building footprints: `/arcgis/rest/services/buildings/MapServer/0/query` (**only supports `f=json`** — Esri JSON, not GeoJSON; backend converts to GeoJSON)
- **Mapbox GL JS** — satellite basemap rendering (requires public token via `VITE_MAPBOX_TOKEN`)

### Ashland GIS Query Notes
- **MapServer vs FeatureServer matters:** FeatureServers support `f=geojson`, MapServers often don't. ArcGIS silently returns empty data (no error) for unsupported output formats — always test with `f=json` first when debugging.
- Native projection is WKID 2270 (NAD 1983 State Plane Oregon South, feet) — use `outSR=4326` or `outSR=3857` to avoid client-side reprojection
- The `inSR` parameter is needed when sending WGS84 coordinates to a service whose native SR is not 4326
- Max 2,000 records per query (paginate with `resultOffset` / `resultRecordCount`)
- Spatial queries use `geometryType`, `geometry`, and `spatialRel` params

## Development Commands

```bash
# Full validation (tests, types, lint for both backend and frontend)
./scripts/validate.sh

# Start PostgreSQL (requires Docker Desktop running)
docker compose up -d

# Backend (from backend/)
poetry install                    # install dependencies
poetry run pytest -v              # run tests
poetry run uvicorn app.main:app --reload  # dev server on :8000
poetry run alembic upgrade head   # run migrations
poetry run alembic revision --autogenerate -m "description"  # create migration

# Frontend (from frontend/)
npm install                       # install dependencies
npm run dev                       # dev server on :5173
npm test                          # run tests
npx tsc -b                        # type-check
npm run lint                      # lint
```

## Data Flow

Address input → Backend queries Taxlots FeatureServer for parcel polygon + centroid → Backend queries Buildings MapServer (spatial query within parcel bbox + buffer) → Frontend computes Turf.js buffer at 5/10/30/100 ft with ring differencing → Mapbox GL JS overlay on satellite basemap.

## Zone Model

| Zone | Distance | Color |
|------|----------|-------|
| Zone 1 | 0–5 ft | Red |
| Zone 2 | 5–10 ft | Orange |
| Zone 3 | 10–30 ft | Yellow |
| Zone 4 | 30–100 ft | Green |

Buffer each building polygon independently, then `turf.union` same-zone rings to handle overlapping structures.

## Key Constraints

- Ashland-only scope — tool won't work for addresses outside Ashland GIS coverage
- Request data in EPSG 4326 or 3857 via `outSR` to avoid reprojection
- Taxlot address fields may require fuzzy matching / normalization
- Consider Web Workers for Turf.js buffer/difference on parcels with many structures

## Accumulated Learnings

### ArcGIS / GIS
- MapServer vs FeatureServer matters: FeatureServers support `f=geojson`, MapServers often only support `f=json` (Esri JSON)
- ArcGIS doesn't error on unsupported output formats — it silently returns empty data
- Always test with `f=json` first when debugging ArcGIS REST endpoints
- The `inSR` parameter is needed when sending WGS84 coordinates to a service whose native SR is not 4326 (Ashland uses WKID 2270)

### Mapbox GL JS
- `map.setLayoutProperty(layerId, 'visibility', 'visible'|'none')` is the correct approach for toggling layers — preserves layer ordering and is performant
- `!important` is needed for `.mapboxgl-ctrl button` sizing since Mapbox GL JS applies its own inline styles
- Adding `role="img"` + `aria-label` to the map container makes it meaningful to screen readers

### Frontend / React
- `@testing-library/user-event` is not installed — use `fireEvent` from `@testing-library/react` for click interactions
- `screen.getByText(/text/)` fails when the same text appears in both visible content and an `aria-live` region — use a more specific matcher to disambiguate
- TanStack Query's `refetch()` is the cleanest way to implement retry buttons
- The `ApiError` class with `errorCode` field enables variant-specific UI messages without string-matching on error messages
- Don't use ref-based guards to skip `useEffect` re-runs when the effect has a cleanup function that removes state (e.g., map layers) — cleanup deletes layers but the guard prevents re-adding them
- For `matchMedia` initialization, use a lazy `useState` initializer instead of setting state in a `useEffect` (avoids `react-hooks/set-state-in-effect` lint rule)
- `min-width: 0` on flex search inputs prevents overflow on narrow viewports (flex items don't shrink below content size by default)
- `turf.area()` accepts a FeatureCollection directly — no need to iterate individual features

### CSS / Design
- Dark frosted glass (`rgba(0,0,0,0.55)` + `backdrop-filter: blur`) reads better over satellite imagery than light/white glass
- CSS `@media (max-width: 768px)` is preferable to JS `matchMedia` for layout breakpoints — works correctly with browser zoom
- Switching overlays from `position: absolute` to `position: static` at breakpoints lets them flow naturally in flex column layout
- 44px minimum touch targets should be universal (not behind a media query) per WCAG 2.5.8
- CSS custom properties in `:root` maintain a consistent spacing/color/typography system across components
