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
All spatial data comes from the City of Ashland's public ArcGIS REST services at `gis.ashland.or.us`. No authentication required. All endpoints support `?f=geojson`.

- **Taxlots FeatureServer** — address lookup, parcel boundaries: `/arcgis/rest/services/taxlots/FeatureServer/0/query`
- **Buildings MapServer** — building footprints: `/arcgis/rest/services/buildings/MapServer/0/query`
- **Mapbox GL JS** — satellite basemap rendering (requires public token)

### Ashland GIS Query Notes
- Native projection is WKID 2270 (NAD 1983 State Plane Oregon South, feet) — use `outSR=4326` or `outSR=3857` to avoid client-side reprojection
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
