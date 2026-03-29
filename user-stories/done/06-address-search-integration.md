# Story: Address Search Integration

## Summary

AS a homeowner
I WANT to type my address, see the map fly to my property with the parcel boundary outlined
SO THAT I can confirm the correct property was found before viewing fire zones

## Acceptance Criteria

- AddressSearch form triggers TanStack Query against `GET /api/parcels?address={input}`
- On success: map `flyTo` parcel centroid at zoom ~18; parcel drawn as dashed outline via Mapbox GL `fill` + `line` layer
- Multiple results: disambiguation list for user to select; no results: inline message "No parcels found for this address"
- Loading spinner on submit button, button disabled during fetch
- Placeholder text with example Ashland address (e.g., "123 Main St, Ashland")
- Submittable via both button click and Enter key
- Visible focus indicators (3:1 contrast) on input and button
- Errors announced to screen readers via `aria-live="assertive"` / `role="alert"`
- Vitest tests: single result flow, multiple result selection, no results message, error state

## Notes

- Size: M
- Priority: P1
- Dependencies: Story 2 (Parcel Lookup API), Story 4 (Satellite Basemap)
- UX: forgiving search with address normalization handled server-side
- A11y: keyboard accessible, screen reader error announcements, visible focus rings

## Implementation Plan

[to be filled in by Claude, including test plan]

## Learnings

[to be filled in by Claude after implementation]
