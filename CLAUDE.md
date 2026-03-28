# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Fireshire** is a fire-resilient landscaping zone visualizer built for the Ashland Fire-Resilient Landscaping Hackathon (White Rabbit co-working community, Ashland, OR). It accepts a property address, displays a satellite overhead view, and overlays color-coded buffer zones around detected building structures based on CAL FIRE / IBHS "Home Ignition Zone" distance bands.

## Architecture

### Backend — Python
- **Framework:** FastAPI
- **Database migrations:** Alembic
- **Tests:** pytest

### Frontend — TypeScript/React
- **Framework:** React with TanStack (Router, Query)
- **Build:** Vite
- **Tests:** Vitest
- **Map:** Mapbox GL JS (satellite basemap) with Leaflet as fallback
- **Geometry:** Turf.js for client-side buffer/difference operations on building polygons

### External APIs (all free, no keys except Mapbox)
- Nominatim (OpenStreetMap) — address geocoding
- Overpass API (OpenStreetMap) — building footprint GeoJSON
- Mapbox GL JS — map rendering (requires public token)

## Data Flow

Address input → Backend geocodes via Nominatim → Backend fetches building footprints from Overpass (within ~150m bbox) → Frontend computes Turf.js buffer at 5/10/30/100 ft with ring differencing → Mapbox GL JS overlay on satellite basemap.

## Zone Model

| Zone | Distance | Color |
|------|----------|-------|
| Zone 1 | 0–5 ft | Red |
| Zone 2 | 5–10 ft | Orange |
| Zone 3 | 10–30 ft | Yellow |
| Zone 4 | 30–100 ft | Green |

Buffer each building polygon independently, then `turf.union` same-zone rings to handle overlapping structures.

## Key Constraints

- Set a descriptive `User-Agent` header on Nominatim requests per OSM policy
- Cache Overpass results per address — don't re-query on every render
- Consider Web Workers for Turf.js buffer/difference on parcels with many structures
- Microsoft Global Building Footprints is the fallback when OSM coverage is sparse
