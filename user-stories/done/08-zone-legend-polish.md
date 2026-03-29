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
- Fire strategy labels: Zone 1 "Non-combustible zone", Zone 2 "Ember catch zone", Zone 3 "Lean, clean, green planting", Zone 4 "Reduce fuel continuity"

## Implementation Plan

### Files to Modify

- `src/contexts/MapContext.tsx` — Add `zoneVisibility` state (`Record<string, boolean>`), `toggleZoneVisibility` callback, `zonesReady` boolean, `setZonesReady` setter
- `src/components/ZoneLegend.tsx` — Full rewrite: frosted glass card, toggle buttons, fire strategy descriptions, mobile collapse
- `src/components/ZoneOverlay.tsx` — Consume `zoneVisibility` to control Mapbox layer visibility via `map.setLayoutProperty`; call `setZonesReady(true/false)` on layer create/cleanup

### Files to Create

- `src/components/ZoneLegend.test.tsx` — Tests for rendering, toggle, a11y, mobile collapse

### Implementation Steps

1. **Extend MapContext**: Add `zoneVisibility: { zone1: true, zone2: true, zone3: true, zone4: true }`, `toggleZoneVisibility(zoneId)`, `zonesReady`, `setZonesReady` to context value.

2. **Wire ZoneOverlay**: New `useEffect` watches `zoneVisibility` and calls `map.setLayoutProperty(layerId, 'visibility', 'visible'|'none')` for both `-fill` and `-line` layers. Call `setZonesReady(true)` after layer creation, `setZonesReady(false)` on cleanup.

3. **Rewrite ZoneLegend**:
   - Frosted glass: `backdropFilter: blur(12px)`, `WebkitBackdropFilter` for Safari, `background: rgba(255,255,255,0.15)`, subtle white border, `borderRadius: 8px`
   - Each zone is a `<button>` with color swatch, zone name, distance, fire strategy text
   - Toggle: click flips visibility via `toggleZoneVisibility`; toggled-off rows get `opacity: 0.4` and greyscale swatch
   - `aria-pressed` on each button; all buttons disabled when `zonesReady === false`
   - Mobile collapse: `window.matchMedia('(max-width: 479px)')` drives `isMobile` state; when mobile + collapsed, show compact icon button; tap to expand

### Test Plan

1. Renders all four zone entries with names, distances, and fire strategy descriptions
2. Color swatches have correct background colors
3. Click calls `toggleZoneVisibility` with correct zone ID
4. Toggled-off row has reduced opacity
5. Buttons disabled when `zonesReady` is false
6. `aria-pressed` matches visibility state
7. Mobile: renders compact icon on small viewport (mock `matchMedia`)
8. Mobile: expands on tap to show full legend

## Learnings

- The `react-hooks/set-state-in-effect` lint rule blocks `setState` inside `useEffect` bodies. For `matchMedia` initialization, use a lazy `useState` initializer (e.g., `useState(() => mql?.matches ?? false)`) instead of setting state in the effect. The effect should only attach the `change` listener.
- Dark frosted glass (`rgba(0,0,0,0.55)` + `backdrop-filter: blur`) reads better over satellite imagery than light/white glass, since satellite tiles are predominantly dark (trees, shadows). Light text on dark glass provides strong contrast.
- Zone 1 strategy was shortened from "Non-combustible hardscape only" to "Non-combustible zone" during review — keep descriptions concise for the legend card.
- `map.setLayoutProperty(layerId, 'visibility', 'visible'|'none')` is the correct Mapbox approach for toggling layers without removing/re-adding them — preserves layer ordering and is performant.
