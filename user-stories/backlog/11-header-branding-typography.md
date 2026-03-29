# Story: Header Branding + Typography System

## Summary

AS a hackathon judge or demo viewer
I WANT the app to have a cohesive, professional visual identity
SO THAT it feels like a polished product rather than a raw prototype

## Acceptance Criteria

- Header uses warm dark palette (charcoal #1B2028) with "Fire" (warm tone) / "Shire" (neutral tone) color treatment in the wordmark — no clip-art logos
- Single font family (Inter or DM Sans) loaded via Google Fonts or local woff2, consistent type scale: semi-bold (600) headings, regular (400) body, 12px small labels
- 4px spacing grid (4, 8, 12, 16, 24, 32, 48) applied to all padding/margins, replacing arbitrary inline styles
- Interactive elements share consistent border-radius (6-8px), focus ring style, and hover transition (150ms ease)
- All text meets WCAG AA contrast (4.5:1 body, 3:1 large text) against its background

## Notes

- Size: M
- Priority: P2
- Dependencies: None (can be implemented independently)
- Currently using inline styles with #1a1a1a header — this replaces that with a design system
- First screen the audience sees; sets the tone for the entire demo

## Implementation Plan

### Files to Modify

- `frontend/index.html` — Add Google Fonts `<link>` for Inter (400, 600), update `<title>` to "FireShire"
- `src/index.css` — Add `:root` CSS custom properties (colors, spacing, radii, transitions) and component classes replacing inline styles
- `src/routes/__root.tsx` — Replace inline styles with CSS classes; Fire/Shire wordmark with two colored `<span>` elements
- `src/components/AddressSearch.tsx` — Replace inline styles with CSS classes
- `src/components/ZoneLegend.tsx` — Replace inline styles with CSS classes (keep inline `style` only for dynamic swatch `background`)
- `src/routes/index.tsx` — Replace inline positioning styles with CSS classes

### CSS Custom Properties

```css
:root {
  --color-charcoal: #1B2028;
  --color-fire: #E8652B;
  --color-shire: #D4C9B8;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px;
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --font-size-sm: 12px; --font-size-base: 14px; --font-size-lg: 16px; --font-size-xl: 20px;
  --radius: 6px;
  --transition: 150ms ease;
  --focus-ring: 0 0 0 2px var(--color-fire);
}
```

### Header Redesign

```tsx
<header className="app-header">
  <h1 className="app-header__wordmark">
    <span className="app-header__fire">Fire</span>
    <span className="app-header__shire">Shire</span>
  </h1>
</header>
```

Color contrast: `#E8652B` on `#1B2028` is ~4.1:1 (acceptable for large text at 20px semibold). `#D4C9B8` on `#1B2028` is ~10.5:1. If needed, lighten fire color to `#EE7A45` (~5.0:1).

### Implementation Sequence

1. Add Google Fonts to `index.html`, update title
2. Expand `index.css` with custom properties and component classes
3. Update `__root.tsx` with CSS classes and wordmark
4. Update `AddressSearch.tsx` — swap inline styles for CSS classes
5. Update `ZoneLegend.tsx` — swap inline styles for CSS classes
6. Update `index.tsx` — swap inline positioning for CSS classes
7. Visual check for contrast, spacing, transitions

### Test Plan

1. Header renders `<h1>` containing "Fire" and "Shire" text
2. Wordmark spans have correct CSS classes (`app-header__fire`, `app-header__shire`)
3. AddressSearch renders input and button (existing tests pass with class changes)
4. ZoneLegend renders all four zones (snapshot test for class-based markup)

## Learnings

[to be filled in by Claude after implementation]
