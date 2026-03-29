# Story: Building Footprints API

## Summary

AS a homeowner
I WANT the system to find all building footprints on and near my parcel
SO THAT fire buffer zones can be computed around each structure

## Acceptance Criteria

- `GET /api/buildings?taxlot_id={id}` retrieves parcel geometry, then spatial envelope query against Buildings MapServer
- Uses `geometryType=esriGeometryEnvelope`, `spatialRel=esriSpatialRelIntersects`, `outSR=4326`, `f=geojson`
- Bounding box expanded by 100ft (max zone distance) to capture neighboring structures
- Handles ArcGIS pagination (`resultOffset` / `resultRecordCount`, max 2000/page)
- Returns GeoJSON FeatureCollection; empty FeatureCollection (200) when no buildings found; 503 on GIS failure
- pytest tests cover: single building, multiple buildings, no buildings, pagination across pages, GIS down

## Notes

- Size: M
- Priority: P1
- Dependencies: Story 1 (GIS Service Client), Story 2 (Parcel Lookup API)
- Building metadata may include elevation, floors, year built, sq ft, occupancy code, building class

## Implementation Plan

[to be filled in by Claude, including test plan]

## Learnings

[to be filled in by Claude after implementation]
