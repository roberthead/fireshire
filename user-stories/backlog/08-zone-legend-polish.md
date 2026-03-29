# Story: Zone Legend Polish + Interactivity

## Summary

AS a homeowner viewing my property
I WANT the zone legend to clearly explain each zone with distance, fire strategy, and the ability to toggle zones on/off
SO THAT I can focus on specific zones and understand what action to take

## Acceptance Criteria

- Legend rendered as a frosted glass card (`backdrop-filter: blur`) anchored bottom-right of map
- Each entry shows: color swatch (matching map fill), zone name, distance range, and fire strategy description
- Click/tap a legend entry toggles that zone's visibility on the map
- Toggled-off zone is visually dimmed in the legend (reduced opacity or greyed out)
- Legend collapses to a compact icon on viewports under 480px, expandable on tap
- All legend text meets WCAG 4.5:1 contrast ratio against its background
- Legend only becomes interactive after zones are computed and rendered

## Notes

- Size: S
- Priority: P2
- Dependencies: Story 7 (Zone Overlay Rendering)
- Enhances the existing ZoneLegend component with real interactivity
- Fire strategy labels: Zone 1 "Non-combustible hardscape only", Zone 2 "Ember catch zone", Zone 3 "Lean, clean, green planting", Zone 4 "Reduce fuel continuity"

## Implementation Plan

[to be filled in by Claude, including test plan]

## Learnings

[to be filled in by Claude after implementation]
