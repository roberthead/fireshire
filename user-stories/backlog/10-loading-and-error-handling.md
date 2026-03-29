# Story: Loading States + Error Handling

## Summary

AS a homeowner
I WANT clear visual feedback while data loads and helpful messages when something goes wrong
SO THAT I trust the app is working and can recover from errors

## Acceptance Criteria

- Loading indicator appears within 200ms of submission, with narrative text ("Finding your property..." → "Drawing fire zones...")
- If zone computation takes >3 seconds, reassurance message appears ("Almost there...")
- Backend unreachable: error banner with retry button
- GIS service unavailable (503): specific message about city data source being temporarily unavailable
- Address outside Ashland: friendly message explaining geographic limitation
- No buildings found: parcel shown with message "We found your parcel but no building footprints. Zones are drawn around structures."
- All errors inline (no browser alerts), dismissible, plain language
- Errors announced to screen readers via `role="alert"`

## Notes

- Size: S
- Priority: P2
- Dependencies: Story 6 (Address Search Integration)
- Error messages should use a warm but informative tone appropriate for non-technical homeowners
- Backend already returns structured error responses (503 with detail) from the GIS client

## Implementation Plan

### Files to Create

- `src/components/StatusBanner.tsx` — Reusable banner with variants: `loading` (spinner + text), `error` (red, role="alert", retry/dismiss), `warning` (amber, role="alert"), `info`
- `src/components/StatusBanner.test.tsx` — Tests for each variant, ARIA, dismiss/retry callbacks

### Files to Modify

- `src/lib/api.ts` — Add `ApiError` class with `status`, `errorCode`, `detail` fields; catch `TypeError` from `fetch()` as network error; parse `{ error, detail }` from backend responses
- `src/components/AddressSearch.tsx` — Replace raw error divs with `StatusBanner`; add multi-phase loading text ("Finding your property..." → 3s → "Almost there...") via `useState` + `setTimeout`
- `src/routes/index.tsx` — Add `StatusBanner` for buildings loading ("Drawing fire zones..."), buildings error (with retry), no buildings found message

### Multi-Phase Loading

```
const [loadingText, setLoadingText] = useState("Finding your property...")
useEffect(() => {
  if (!isFetching) return
  setLoadingText("Finding your property...")
  const timer = setTimeout(() => setLoadingText("Almost there..."), 3000)
  return () => clearTimeout(timer)
}, [isFetching])
```

Same pattern in `index.tsx` for the buildings fetch phase with "Drawing fire zones..."

### Error Type Mapping

| Condition | Detection | Message |
|---|---|---|
| Backend unreachable | `fetch` throws `TypeError` | "We can't reach our server right now." + Retry |
| GIS unavailable | Status 503, `errorCode === "gis_unavailable"` | "Ashland's property data source is temporarily unavailable." + Retry |
| No parcels found | `parcels.length === 0` | "We couldn't find that address in Ashland. This tool only covers properties within Ashland city limits." |
| No buildings found | `features.length === 0` | "We found your parcel but no building footprints. Zones are drawn around structures." |

### ARIA

- Error/warning banners: `role="alert"` (announced immediately on mount)
- Loading banners: `role="status"` with `aria-live="polite"`
- Banners rendered conditionally (mount/unmount) so `role="alert"` fires correctly

### Test Plan

**StatusBanner.test.tsx:**
1. Renders message text for each variant
2. Error variant has `role="alert"`
3. Loading variant has `role="status"` with `aria-live="polite"`
4. Dismiss button renders only when `onDismiss` provided; calls handler on click
5. Retry button renders only when `onRetry` provided; calls handler on click

**AddressSearch.test.tsx (expand):**
6. Shows loading banner with "Finding your property..." when fetching
7. After 3s, loading text changes to "Almost there..." (`vi.useFakeTimers`)
8. Network error: renders error banner with retry
9. GIS 503: renders appropriate error message
10. Error dismissed on new search submission

## Learnings

[to be filled in by Claude after implementation]
