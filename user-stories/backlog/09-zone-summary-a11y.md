# Story: Text-Based Zone Summary (Screen Reader Alternative)

## Summary

AS a visually impaired homeowner using a screen reader
I WANT a text summary of the fire zones on my property
SO THAT I receive the same actionable information without needing to interpret the map

## Acceptance Criteria

- After successful lookup, a "Zone Summary" panel renders (visible to all users, not `sr-only`) with: property address, number of buildings detected, and for each zone the distance band and approximate area in square feet
- Map container has `role="img"` with dynamically generated `aria-label` (e.g., "Satellite map of 123 Oak Street showing 2 buildings with 4 fire-resilient landscaping zones")
- Zone Summary wrapped in `<section>` with `aria-labelledby` pointing to an `<h2>Zone Summary</h2>` heading
- `aria-live="polite"` announcement when results load (e.g., "Zone analysis complete for 123 Oak Street. 4 zones identified.")
- Proper heading hierarchy: single `<h1>` for app title, `<h2>` for major sections, no skipped levels

## Notes

- Size: M
- Priority: P2
- Dependencies: Story 7 (Zone Overlay Rendering)
- Without this, the entire app output is inaccessible to screen reader users — a map alone conveys zero information to a blind user
- Turf.js area calculations are already available from the buffer computation

## Implementation Plan

### Files to Create

- `src/lib/computeZoneAreas.ts` — Pure function: takes `ZoneResult`, calls `turf.area()` on each zone FeatureCollection, converts m² → ft², returns `{ zoneLabel, distanceBand, areaSqFt }[]`
- `src/lib/computeZoneAreas.test.ts` — Unit tests for area computation
- `src/components/ZoneSummary.tsx` — Visible Zone Summary panel component
- `src/components/ZoneSummary.test.tsx` — Tests for rendering, ARIA, aria-live

### Files to Modify

- `src/routes/index.tsx` — Wire ZoneSummary into layout, pass address/buildings props
- `src/components/MapView.tsx` — Add `role="img"` and dynamic `aria-label` to map container

### Implementation Sequence

1. **computeZoneAreas.ts**: Call `turf.area()` on each zone FeatureCollection (returns m²), multiply by 10.7639 for ft², round to whole number. Zone metadata constant array provides labels and distance bands. Pure function, no React deps.

2. **ZoneSummary.tsx**: Wrap in `<section aria-labelledby="zone-summary-heading">`. Include `<h2 id="zone-summary-heading">Zone Summary</h2>`. Show address, building count, then `<dl>` with `<dt>` for zone label + band, `<dd>` for area. Include a visually hidden `<div aria-live="polite">` that announces "Zone analysis complete for {address}. 4 zones identified." on mount via `useEffect` + short `setTimeout`.

3. **MapView.tsx**: Add `role="img"` and optional `ariaLabel` prop to map container div. Parent computes label dynamically: "Satellite map of {address} showing {n} buildings with 4 fire-resilient landscaping zones" or generic "Satellite map of Ashland, Oregon" when no buildings loaded.

4. **index.tsx**: Position ZoneSummary at bottom-left (`position: absolute, bottom: 1rem, left: 1rem`), rendered only when buildings are loaded. Pass `address`, `buildingCount`, and `buildings` props. Compute and pass `ariaLabel` to MapView.

### Test Plan

**computeZoneAreas.test.ts:**
- Returns 4 zone entries with label, band, areaSqFt
- Areas are positive for non-empty zones, 0 for empty FeatureCollections
- Outer zones have larger areas than inner zones (zone4 > zone3 > zone2 > zone1)

**ZoneSummary.test.tsx:**
- Renders `<section>` with `aria-labelledby="zone-summary-heading"`
- Contains `<h2>` with text "Zone Summary"
- Displays property address and building count
- Renders each zone's distance band and area
- Contains `aria-live="polite"` element with announcement text

**MapView.test.tsx (additions):**
- Map container has `role="img"`
- When `ariaLabel` prop provided, container has correct `aria-label`

## Learnings

[to be filled in by Claude after implementation]
