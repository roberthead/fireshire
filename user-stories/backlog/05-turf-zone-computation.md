# Story: Turf.js Zone Buffer Computation

## Summary

AS a developer
I WANT a pure function that takes building footprint polygons and returns four concentric zone ring FeatureCollections
SO THAT zone geometry is testable independently of the map

## Acceptance Criteria

- `computeZoneRings(buildings: FeatureCollection): ZoneResult` returns `{ zone1, zone2, zone3, zone4 }` FeatureCollections
- For each building: `turf.buffer` at 5, 10, 30, 100 ft; ring differencing via `turf.difference` (zone1 = buffer(5ft) - building, zone2 = buffer(10ft) - buffer(5ft), etc.)
- `turf.union` merges same-zone rings across all buildings so overlapping zones produce clean single polygons
- Handles edge cases: single building, no buildings (returns empty FeatureCollections), multipolygon geometries
- Vitest tests validate: correct ring count, ring nesting order, union reduces polygon count for overlapping buildings, empty input

## Notes

- Size: L
- Priority: P1
- Dependencies: None (parallel with all other Phase 1 stories)
- Zone model: Zone 1 (0-5ft, red), Zone 2 (5-10ft, orange), Zone 3 (10-30ft, yellow), Zone 4 (30-100ft, green)
- Consider Web Workers for parcels with many structures if performance is an issue

## Implementation Plan

[to be filled in by Claude, including test plan]

## Learnings

[to be filled in by Claude after implementation]
