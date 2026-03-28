# Fire-Resilient Landscaping Zone Visualizer — Planning Doc

## Project Goal

Build a front-end tool that accepts a property address, displays a satellite overhead view, and overlays color-coded buffer zones around detected building structures. Each zone corresponds to a distance band used by the plant database to recommend fire-resistant (or fire-risky) plants at each proximity to the home.

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

## API Stack

### 1. Geocoding — Address → Lat/Lng
- **Provider:** Nominatim (OpenStreetMap)
- **Free:** Yes, no API key required
- **Endpoint:** `GET https://nominatim.openstreetmap.org/search?q={address}&format=json`
- **Usage note:** Set a descriptive `User-Agent` header per OSM policy

### 2. Building Footprints — Lat/Lng → GeoJSON Polygons
- **Provider:** Overpass API (OpenStreetMap)
- **Free:** Yes, no API key required
- **Query:** Fetch all `building=*` ways within a bounding box around the geocoded point
- **Endpoint:** `https://overpass-api.de/api/interpreter`
- **Output:** GeoJSON polygons for each detected structure
- **Fallback:** Microsoft Global Building Footprints dataset (downloadable by Oregon county, ML-derived from aerial imagery — use when OSM coverage is sparse in rural/suburban parcels)

### 3. Buffer Zone Geometry — Polygons → Distance Rings
- **Library:** Turf.js (client-side, no API required)
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

### 4. Map Display + Overlay
- **Provider:** Mapbox GL JS (preferred)
  - Free tier: 50,000 map loads/month
  - Requires a Mapbox public token
  - Satellite basemap: `mapbox://styles/mapbox/satellite-v9`
  - Supports GeoJSON layers with per-feature fill color and opacity
- **Alternative (no API key):** Leaflet.js + Esri World Imagery tiles
  - `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
  - Free, no key, but slightly less control over styling

---

## Data Flow

```
User enters address
        ↓
Nominatim API → { lat, lng }
        ↓
Overpass API → building footprint GeoJSON (all structures within ~200ft radius)
        ↓
Turf.js → buffer each polygon at 5, 10, 30, 100 ft → difference to rings
        ↓
Mapbox GL JS → render satellite basemap + 4 GeoJSON layers (one per zone)
        ↓
(Future) Zone click / hover → query plant database for recommendations
```

---

## Front-End Architecture

- **Framework:** React (with Vite or as standalone HTML depending on deployment context)
- **Map library:** Mapbox GL JS or Leaflet
- **Geometry:** Turf.js
- **State:** Address input → geocode result → building features → zone layers
- **Styling:** Zone layers rendered as semi-transparent fills with colored strokes

### Key UI Components
1. **AddressSearch** — text input + submit, calls Nominatim
2. **MapView** — Mapbox/Leaflet map centered on geocoded point
3. **BuildingLayer** — renders raw building footprints from Overpass
4. **ZoneLayer** — renders 4 colored buffer ring layers via Turf.js
5. **ZoneLegend** — color key with zone labels and distance ranges
6. **(Future) PlantPanel** — sidebar showing plant recommendations per zone on click/hover

---

## Known Caveats & Decisions

- **OSM coverage:** Ashland and most of the Rogue Valley have decent OSM building coverage, but rural parcels may have gaps. Plan for the Microsoft Building Footprints fallback.
- **Overpass rate limits:** Overpass is a shared public resource. Cache results per address; don't re-query on every render.
- **Turf.js + large parcels:** If a parcel has many structures, buffer + difference operations can be slow. Consider running in a Web Worker for responsiveness.
- **Coordinate precision:** Nominatim returns bounding boxes; use the `lat`/`lon` centroid fields for map centering.
- **Overpass bounding box:** Query a ~150m radius bounding box around the geocoded point to catch all on-parcel structures without pulling in too much neighbor data.
- **Zone overlap between structures:** If two buildings are within 100ft of each other, their zone rings will overlap. Use `turf.union` to merge same-zone rings before rendering.

---

## Future Enhancements

- Integrate plant database API: on zone click, fetch and display recommended/discouraged plants
- Parcel boundary overlay (Regrid or county assessor GIS data) to constrain zones to the property
- "What's here?" feature: click anywhere on map to identify current zone and get plant guidance
- Export/print view of the zoned map for homeowners
- Mobile-responsive layout for on-site use

---

## References

- [CAL FIRE Home Hardening & Defensible Space](https://www.fire.ca.gov/programs/communications/defensible-space-home-hardening/)
- [IBHS Wildfire Home Assessment](https://ibhs.org/wildfire/)
- [Overpass API documentation](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [Turf.js documentation](https://turfjs.org/)
- [Microsoft Global Building Footprints](https://github.com/microsoft/GlobalMLBuildingFootprints)
- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
