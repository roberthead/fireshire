# Bug: Buildings MapServer returns empty results

AS a user
I WANT to see the buildings
SO THAT I can see the zones

## Root Cause

Our backend requests `f=geojson` from the Ashland Buildings MapServer at:
`/arcgis/rest/services/buildings/MapServer/0/query`

This MapServer **does not support GeoJSON output format**. When `f=geojson` is requested, it silently returns empty results rather than an error.

The Taxlots endpoint is a **FeatureServer** which supports `f=geojson`. The Buildings endpoint is a **MapServer** — MapServers in older ArcGIS Enterprise deployments often only support `f=json` (Esri JSON format).

## Evidence

- `f=json` with spatial query returns building features with `geometry.rings` arrays — **confirmed working**
- `f=geojson` returns empty results — this is what our code uses
- The planning app at `gis.ashland.or.us/planning/` renders buildings fine (uses Esri's native format)
- No authentication issue — the service is public

## Fix

1. Change `buildings.py` to request `f=json` instead of `f=geojson`
2. Convert Esri JSON response (with `geometry.rings`) to GeoJSON FeatureCollection
   - Esri `rings` maps directly to GeoJSON `coordinates` for Polygon
   - Esri `attributes` → GeoJSON `properties`
3. `outSR=4326` still works with `f=json`, so coordinates stay in WGS84
4. Add `inSR=4326` to the spatial query params so the server knows our bbox coordinates are WGS84

## Esri JSON → GeoJSON Conversion

Esri polygon: `{ "attributes": {...}, "geometry": { "rings": [[[x,y],...]] } }`
GeoJSON polygon: `{ "type": "Feature", "properties": {...}, "geometry": { "type": "Polygon", "coordinates": [[[x,y],...]] } }`

## Additional Fix: ZoneOverlay rendering bug

The zones were being computed correctly (Zone Summary showed areas) but not rendering on the map. `ZoneOverlay.tsx` used a `prevBuildingsRef` to skip re-computation when the `buildings` reference hadn't changed. But the `useEffect` cleanup function removes all map layers — when React re-runs the effect, cleanup fires (deleting layers), then the ref guard skips re-adding them. Fix: removed the `prevBuildingsRef` guard entirely.

## Learnings

- MapServer vs FeatureServer matters: FeatureServers support `f=geojson`, MapServers often don't
- ArcGIS doesn't error on unsupported output formats — it silently returns empty data
- Always test with `f=json` first when debugging ArcGIS REST endpoints
- The `inSR` parameter is needed when sending WGS84 coordinates to a service whose native SR is not 4326 (Ashland uses WKID 2270)
- Don't use ref-based guards to skip `useEffect` re-runs when the effect has a cleanup function that removes state (e.g., map layers) — the cleanup will delete layers but the guard prevents re-adding them
