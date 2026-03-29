# Story: Zone Overlay Rendering

## Summary

AS a homeowner
I WANT to see color-coded fire zones rendered as translucent rings around my buildings on the satellite map
SO THAT I understand which parts of my landscape fall into each fire-resilience zone

## Acceptance Criteria

- After parcel selection and building fetch, `computeZoneRings` runs and four zone FeatureCollections are added as Mapbox GL `fill` + `line` layers
- Zone colors: red `#e53e3e`, orange `#ed8936`, yellow `#ecc94b`, green `#48bb78`
- Inner zones (red, orange) at ~40% opacity; outer zones (yellow, green) at ~30% for satellite readability
- 2px solid borders at full saturation for crisp ring boundaries
- Building footprints rendered as white/gray stroke layer (no fill) on top of zones
- Z-order: zone4 (bottom) → zone3 → zone2 → zone1 → buildings (top)
- Previous layers cleaned up before adding new ones on re-search
- Distinct fill patterns (hatching/dots) in addition to color for color-blind accessibility (WCAG 1.4.1)
- Vitest tests: correct number of sources/layers, layer ordering, cleanup on re-search

## Notes

- Size: L
- Priority: P1
- Dependencies: Story 3 (Buildings API), Story 4 (Satellite Basemap), Story 5 (Turf.js Zones), Story 6 (Address Search)
- This is the core visual payoff of the entire application
- Opacity values calibrated so both dark (trees, shadows) and light (rooftops, pavement) satellite imagery remains visible

## Implementation Plan

[to be filled in by Claude, including test plan]

## Learnings

[to be filled in by Claude after implementation]
