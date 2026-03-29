---
marp: true
theme: uncover
class: invert
paginate: true
---

# FireShire

### Fire-Resilient Landscaping Zone Visualizer

Ashland Fire-Resilient Landscaping Hackathon
White Rabbit Co-Working | Ashland, OR

---

## The Problem

- Wildfire risk is increasing in Ashland and the Rogue Valley
- Homeowners need clear guidance on defensible space around structures
- CAL FIRE / IBHS define "Home Ignition Zones" but they're hard to visualize
- Choosing fire-resilient plants for each zone is overwhelming

---

## What FireShire Does

Enter an Ashland address and instantly see:

1. Your **parcel boundary** on a satellite map
2. **Color-coded buffer zones** around every building on the property
3. **Recommended plants** for each active zone
4. An **AI chat assistant** for fire-resilient landscaping questions

---

## Home Ignition Zones

| Zone   | Distance  | Color  | Risk Level     |
|--------|-----------|--------|----------------|
| Zone 1 | 0 -- 5 ft   | Red    | Immediate      |
| Zone 2 | 5 -- 10 ft  | Orange | Near-structure |
| Zone 3 | 10 -- 30 ft | Yellow | Intermediate   |
| Zone 4 | 30 -- 100 ft| Green  | Extended       |

Zones are computed per-building and merged for multi-structure properties.

---

## Data Sources

- **Ashland GIS** (ArcGIS Enterprise) -- taxlot parcels and building footprints
- **LWF Plants API** -- fire-zone plant recommendations
- **Mapbox GL JS** -- satellite basemap
- **Anthropic Claude** -- AI landscaping assistant

No authentication required for city data. All public.

---

## Architecture

```
 Address Input
      |
  FastAPI Backend
      |
  +---+---+
  |       |
Taxlots  Buildings
(ArcGIS) (ArcGIS)
  |       |
  +---+---+
      |
 React Frontend
      |
  +---+---+---+
  |   |   |   |
 Map Zones Plants Chat
```

- **Backend**: Python / FastAPI -- proxies Ashland GIS queries
- **Frontend**: React / TanStack / Vite -- map, zones, plant panel, chat
- **Geometry**: Turf.js -- client-side buffer & ring differencing
- **Deploy**: Vercel Services -- frontend + backend in one project

---

## Key Features Built

- Address search with fuzzy matching
- Satellite map with parcel overlay
- Per-building zone buffer computation with overlap handling
- Interactive zone legend with visibility toggles
- Accessible zone summary for screen readers
- Plant recommendations filtered by active zones
- AI chat assistant ("Rascal") for landscaping guidance
- Mobile-responsive layout with WCAG touch targets

---

## Tech Highlights

- **Turf.js ring differencing** -- outer zones don't cover inner zones, even across multiple buildings
- **Dark frosted-glass UI** -- readable over satellite imagery
- **Streaming AI chat** -- Claude API with SSE for real-time responses
- **Zero database needed** -- all data proxied from public GIS services
- **Vercel Services** -- single deploy for both Python API and React app

---

## Live Demo

**fireshire.vercel.app**
