# Fire-Resilient Landscaping Zone Visualizer — Planning Doc

## Project Goal

Build a tool that accepts an Ashland, OR property address, displays a satellite view, and overlays color-coded buffer zones around building footprints. Each zone corresponds to a distance band used by the plant database to recommend fire-resistant (or fire-risky) plants at each proximity to the home.

This tool is being developed for the **Ashland Fire-Resilient Landscaping Hackathon**, organized through the White Rabbit co-working community in Ashland, OR.

---

## Zone Model

Distances are defined by the plant database and map to CAL FIRE / IBHS "Home Ignition Zone" concepts:

| Zone | Distance from Structure | Suggested Color | Fire Strategy |
|------|------------------------|-----------------|---------------|
| Zone 1 | 0–5 ft   | Red    | Non-combustible hardscape only |
| Zone 2 | 5–10 ft  | Orange | Highest-risk ember catch zone |
| Zone 3 | 10–30 ft | Yellow | Lean, clean, green planting |
| Zone 4 | 30–100 ft | Green | Reduce fuel continuity |

---

## Data Source: Ashland GIS (ArcGIS Enterprise)

All spatial data comes from the City of Ashland's public ArcGIS REST services at `gis.ashland.or.us`. No authentication required. All endpoints support `?f=geojson` for GeoJSON output.

### 1. Address Lookup — Address → Parcel + Lat/Lng

- **Service:** Taxlots FeatureServer
- **Endpoint:** `https://gis.ashland.or.us/arcgis/rest/services/taxlots/FeatureServer/0/query`
- **Approach:** Query by site address field to get the parcel polygon, centroid, and metadata (owner, acreage, zoning)
- **Output:** Parcel GeoJSON polygon + centroid for map centering
- **Max records per query:** 2,000 (paginate with `resultOffset` / `resultRecordCount`)

### 2. Building Footprints — Parcel Area → Building Polygons

- **Service:** Buildings MapServer
- **Endpoint:** `https://gis.ashland.or.us/arcgis/rest/services/buildings/MapServer/0/query`
- **Approach:** Spatial query using the parcel bounding box (plus buffer for neighboring structures) to fetch building footprint polygons
- **Output:** GeoJSON polygons with metadata (elevation, floors, year built, sq ft, occupancy code, building class)

### 3. Buffer Zone Geometry — Polygons → Distance Rings

- **Library:** Turf.js (client-side)
- **Approach:**
  ```javascript
  const z1 = turf.buffer(building, 5,   { units: 'feet' })
  const z2 = turf.buffer(building, 10,  { units: 'feet' })
  const z3 = turf.buffer(building, 30,  { units: 'feet' })
  const z4 = turf.buffer(building, 100, { units: 'feet' })

  // Subtract inner from outer to get rings, not filled circles
  const ring1 = z1                          // 0–5 ft
  const ring2 = turf.difference(z2, z1)    // 5–10 ft
  const ring3 = turf.difference(z3, z2)    // 10–30 ft
  const ring4 = turf.difference(z4, z3)    // 30–100 ft
  ```
- **Note:** Run `turf.buffer` on each building polygon independently, then union all same-zone rings so overlapping structures merge correctly

### 4. Parcel Boundary Overlay

- **Source:** Same taxlots query from step 1
- **Approach:** Render the parcel polygon as a dashed outline to show property boundaries
- **Use:** Clip or visually constrain zone rings to the parcel extent

### 5. Map Display + Overlay

- **Provider:** Mapbox GL JS
  - Free tier: 50,000 map loads/month
  - Requires a Mapbox public token
  - Satellite basemap: `mapbox://styles/mapbox/satellite-v9`
  - Supports GeoJSON layers with per-feature fill color and opacity
- **Alternative:** Ashland's own aerial imagery via ImageServer (2018 vintage)
  - `https://gis.ashland.or.us/imageserver23/rest/services/Imagery_2018/ImageServer`
- **Fallback:** Leaflet.js + Esri World Imagery tiles (no key required)

---

## Tech Stack

### Backend — Python
- **Framework:** FastAPI
- **Database migrations:** Alembic
- **Tests:** pytest
- **Role:** Proxy and cache Ashland GIS queries, serve API to frontend

### Frontend — TypeScript/React
- **Framework:** React with TanStack (Router, Query)
- **Build:** Vite
- **Tests:** Vitest
- **Map:** Mapbox GL JS
- **Geometry:** Turf.js

---

## Data Flow

```
User enters Ashland address
        ↓
Backend queries Taxlots FeatureServer → parcel polygon + centroid
        ↓
Backend queries Buildings MapServer (spatial query within parcel bbox + buffer) → building footprint GeoJSON
        ↓
Frontend receives parcel + buildings via FastAPI
        ↓
Turf.js → buffer each building at 5, 10, 30, 100 ft → difference to rings → union same-zone rings
        ↓
Mapbox GL JS → satellite basemap + parcel boundary + building footprints + 4 zone ring layers
        ↓
(Future) Zone click / hover → query plant database for recommendations
```

---

## Available Ashland Fire Data (Future Use)

The Ashland GIS server has fire-specific services that could enrich the tool:

| Service | Endpoint Path | Content |
|---------|--------------|---------|
| Firewise Communities | `/fire/FirewiseCommunities/MapServer` | Community boundaries, vegetation removal tracking, risk reduction investments |
| Flame Length Modeling | `/hosted/Post_Flame_Length2_WTL1/MapServer` | Pre/post treatment flame length modeling |
| Forest Resiliency | `/fire/AshlandForestResiliency/MapServer` | Forest plots, management units, tree mortality 2020 |
| Wildfire Adaptation | `/fire/Adaptation_Project_2023/MapServer` | Wildfire adaptation project areas |
| Forest Climate Adaptation | `/fire/ForestLandClimateAdaptation/MapServer` | Canopy cover analysis, climate refugia |
| LiDAR | `/hosted/COA_ForestLandClimateAdaptation_Lidar/SceneServer` | 3D LiDAR scene data |

---

## Front-End Architecture

### Key UI Components
1. **AddressSearch** — text input + submit, queries taxlots by address
2. **MapView** — Mapbox map centered on parcel centroid, satellite basemap
3. **ParcelLayer** — dashed outline of property boundary from taxlots
4. **BuildingLayer** — renders building footprints from Ashland buildings service
5. **ZoneLayer** — renders 4 colored buffer ring layers computed by Turf.js
6. **ZoneLegend** — color key with zone labels and distance ranges
7. **(Future) PlantPanel** — sidebar showing plant recommendations per zone on click/hover

---

## Known Caveats & Decisions

- **Ashland-only scope:** All data comes from Ashland's GIS. This tool won't work for addresses outside city limits / the Ashland GIS coverage area.
- **Coordinate projection:** Ashland's native projection is NAD 1983 State Plane Oregon South (WKID 2270, feet). Request data in EPSG 4326 or 3857 via the `outSR` parameter to avoid client-side reprojection.
- **Max records:** ArcGIS REST queries return max 2,000 records per request. Not a concern for single-parcel lookups but relevant if batch-querying.
- **Address matching:** Taxlot address fields may require fuzzy matching or normalization. Test with common Ashland address formats.
- **Zone overlap between structures:** If two buildings are within 100ft of each other, their zone rings will overlap. Use `turf.union` to merge same-zone rings before rendering.
- **Turf.js performance:** For parcels with many structures, buffer + difference operations can be slow. Consider running in a Web Worker.

---

## Future Enhancements

- Integrate plant database API: on zone click, fetch and display recommended/discouraged plants
- Overlay Firewise community boundaries and flame length modeling data
- "What's here?" feature: click anywhere on map to identify current zone and get plant guidance
- Export/print view of the zoned map for homeowners
- Mobile-responsive layout for on-site use

---

## References

- [City of Ashland GIS Services](https://gis.ashland.or.us/arcgis/rest/services)
- [CAL FIRE Home Hardening & Defensible Space](https://www.fire.ca.gov/programs/communications/defensible-space-home-hardening/)
- [IBHS Wildfire Home Assessment](https://ibhs.org/wildfire/)
- [Turf.js documentation](https://turfjs.org/)
- [ArcGIS REST API Query Reference](https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/)
