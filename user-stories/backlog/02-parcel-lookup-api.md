# Story: Parcel Lookup API

## Summary

AS a homeowner
I WANT to enter my Ashland address and have the system find my property parcel
SO THAT the app can locate my property on the map

## Acceptance Criteria

- `GET /api/parcels?address={query}` queries the Ashland Taxlots FeatureServer with `outSR=4326` and `f=geojson`
- Input address is normalized: uppercase, trimmed, common abbreviations handled (St/Street, Ave/Avenue)
- Uses SQL `LIKE` with wildcards for partial/fuzzy matching
- Returns JSON with: GeoJSON polygon, centroid (lng/lat), site address, taxlot ID, acreage
- Empty array on no match (200), 503 on GIS failure via `GISServiceError`
- pytest tests cover: match, no match, normalization variants, GIS service down

## Notes

- Size: M
- Priority: P1
- Dependencies: Story 1 (GIS Service Client)
- Taxlot address fields may require fuzzy matching — test with common Ashland address formats
- Native projection is WKID 2270; always request `outSR=4326` to avoid client-side reprojection

## Implementation Plan

[to be filled in by Claude, including test plan]

## Learnings

[to be filled in by Claude after implementation]
