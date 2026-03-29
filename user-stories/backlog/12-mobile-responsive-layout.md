# Story: Mobile-Responsive Layout

## Summary

AS a homeowner at a community event or standing in my yard
I WANT to use the app on my phone
SO THAT I can look up my property anywhere

## Acceptance Criteria

- Under 768px: layout stacks vertically — search on top, map fills remaining viewport height, legend as compact collapsible panel
- 44x44px minimum touch targets on all interactive elements (WCAG 2.5.8)
- Map occupies at least 60% of viewport height on mobile
- No horizontal scrolling at 320px minimum width
- Legend repositions to bottom-center on mobile with horizontal layout (swatches in a row)
- Touch interactions work for map navigation and zone tapping
- Works at 200% browser zoom without content clipping (WCAG 1.4.4, 1.4.10)

## Notes

- Size: M
- Priority: P3
- Dependencies: Story 6 (Address Search), Story 7 (Zone Rendering), Story 8 (Legend)
- Important for on-site use at community events but can be deferred past the initial demo
- Test on iOS Safari for scroll bounce issues

## Implementation Plan

### Breakpoint Strategy

| Breakpoint | Target | Behavior |
|---|---|---|
| <= 768px | Tablets/large phones | Stack vertically; legend becomes collapsible horizontal panel at bottom |
| <= 480px | Standard phones | Full-width search input, reduced padding/font sizes |
| >= 320px | Minimum supported | No horizontal overflow; WCAG 1.4.10 reflow compliance |

Use CSS `max-width` media queries (not JS `matchMedia`) — works with browser zoom, no hydration risk.

### Files to Modify

- `src/index.css` — Add CSS classes (`.search-panel`, `.legend-panel`, `.map-container`, `.legend-toggle`, `.legend-content`) with desktop defaults and `@media` breakpoints
- `src/routes/__root.tsx` — Replace inline styles with CSS classes (`.app-layout`, `.app-header`, `.app-main`)
- `src/routes/index.tsx` — Replace absolute positioning inline styles with `.search-panel`, `.legend-panel`, `.map-container` classes
- `src/components/AddressSearch.tsx` — Add `.search-input`, `.search-button`, `.search-result-item` classes for touch targets and responsive width
- `src/components/ZoneLegend.tsx` — Add collapse/expand toggle button (`.legend-toggle`), wrap content in `.legend-content`; toggle hidden on desktop via CSS `display: none`

### Layout at <= 768px

- `.app-main` becomes `display: flex; flex-direction: column`
- `.search-panel` becomes static (no absolute positioning), full width
- `.map-container` gets `flex: 1; min-height: 60vh`
- `.legend-panel` becomes `position: fixed; bottom: 0; left: 50%; transform: translateX(-50%)` overlaying map bottom
- `.legend-toggle` becomes visible; legend content defaults collapsed
- Legend content uses `flex-direction: row; flex-wrap: wrap` for horizontal swatch layout

### Touch Targets (44px minimum — universal, not mobile-only)

- `.search-input { min-height: 44px; }`
- `.search-button { min-height: 44px; min-width: 44px; }`
- `.search-result-item { min-height: 44px; }`
- `.legend-toggle { min-height: 44px; min-width: 44px; }`
- `.legend-row { min-height: 44px; }` (on mobile)
- Mapbox controls: `.mapboxgl-ctrl button { min-width: 44px; min-height: 44px; }`

### Legend Collapse/Expand

- Always render toggle button; CSS hides it at > 768px
- `collapsed` React state (default `true`); toggling shows/hides `.legend-content`
- Button text: "Zones ▸" collapsed, "Zones ▾" expanded
- Semi-transparent background on expanded panel for readability over map

### 200% Zoom Testing (WCAG 1.4.4 / 1.4.10)

At 200% zoom on 1280px display → 640px effective CSS width → triggers <= 768px breakpoint. Verify:
- No horizontal scrollbar at 640px
- Search input switches to `width: 100%` (overriding 300px)
- No `overflow: hidden` clipping content
- Long addresses wrap with `word-wrap: break-word`

### Test Plan

**ZoneLegend.test.tsx:**
1. Renders all four zone labels
2. Toggle button exists with accessible name
3. Clicking toggle flips collapsed class on content

**Structural tests (AddressSearch.test.tsx updates):**
4. Search input has `.search-input` class
5. Search button has `.search-button` class
6. Result items have `.search-result-item` class

**Manual test checklist (not automatable in jsdom):**
- 768px: vertical stack, search on top, map fills space, legend at bottom
- 480px: full-width input, no horizontal scroll
- 320px: no overflow, all content accessible
- 200% zoom: responsive layout activates, no clipping
- iOS Safari: no scroll bounce on map container

## Learnings

[to be filled in by Claude after implementation]
