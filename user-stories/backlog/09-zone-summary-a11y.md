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

[to be filled in by Claude, including test plan]

## Learnings

[to be filled in by Claude after implementation]
