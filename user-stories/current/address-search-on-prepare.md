# Story: Address Search On Prepare

## Summary

AS a User
ON /prepare
I WANT to search for my address
SO THAT I can continue on to the map

## Acceptance Criteria

- The search results should succeed for any address in ashland
- fuzzy search

## Notes

The search on the map page (at /) already uses fuzzy search. Extract it for re-use if necessary.
Should behave the same.

## Implementation Plan

### Overview

**Chosen approach: Hybrid (backend parity + frontend extraction).** The AC "succeed for any address in Ashland" cannot be met by the current pg_trgm-only AllClear search — it has no USPS suffix/directional canonicalization, no parsed-number-plus-street query, and no rapidfuzz "Did you mean…?" fallback (which were the entire point of the recent flexible-address-matching story). We therefore (1) reuse `app/services/address_normalizer.py` on the backend so the AllClear endpoint matches like `/api/parcels` does, and (2) extract the UX shell from `AddressSearch.tsx` into a reusable presentational component so the prepare page gets the same auto-select / disambiguation / suggestions / banner UX without dragging Mapbox concerns into a non-map route. The two halves are independent and reviewable on their own.

Critical dependency: this only works if the AllClear `parcels` table actually contains every Ashland situs address. That must be verified (see Open Questions) before Increment 1 lands; if there is a meaningful coverage gap, Increment 4 adds a GIS fallback path.

### Open Questions (need answers BEFORE Increment 1)

1. **AllClear DB coverage.** Does the `parcels` table on Neon contain every Ashland parcel that the live Taxlots FeatureServer returns? A `SELECT COUNT(DISTINCT situs_address)` against the AllClear DB compared with a sampling of Ashland streets via the GIS endpoint would answer this. If coverage is materially incomplete, we cannot meet "succeed for any address in Ashland" purely by improving the AllClear query — we'd need either backfill of seed data, or the Increment 4 fallback that explains the situation rather than silently failing.
2. **Owner/occupant duplicates.** A single situs_address can produce 1–2 rows (one per `role`). Today the prepare page lists them both as separate selectable results, distinguishing by " · Owner" / " · Occupant" suffix. Confirm this is intentional UX rather than something to dedupe — affects how the new disambiguation list renders.
3. **Auto-select policy on prepare.** The map page auto-selects when a search returns exactly one parcel. On `/prepare` this would auto-navigate to `/survey/$hashCode`, which is more disruptive than panning a map. Recommend: do NOT auto-navigate; always require an explicit click to leave the page. Confirm.

### Increment 1 — Backend parity for AllClear address search

Bring `routers/allclear.py:search_parcels` to functional parity with `routers/parcels.py:lookup_parcels`, reusing the existing `address_normalizer` module.

- Modify `backend/app/routers/allclear.py`:
  - Import `parse_address`, `normalize_address` from `app.services.address_normalizer`.
  - Replace `search_parcels` body: (a) `parse_address(address)` → `{ number, street }`; (b) build SQLAlchemy filter `Parcel.situs_address ILIKE '<number> <street>%'` when number is present, fall back to `ILIKE '%<street>%'` when only a street is supplied; (c) if zero rows AND a number was parsed, query siblings (`situs_address ILIKE '<number> %'`, limit ~50), run `rapidfuzz.fuzz.WRatio` against the normalized input, applying the same `PROMOTE_THRESHOLD=85` / `SUGGEST_THRESHOLD=70` / `PROMOTE_MARGIN=5` constants used in `parcels.py`.
  - Change response from `list[ParcelOut]` to `ParcelSearchOut`: `{ parcels: list[ParcelOut], suggestions: list[SuggestionOut] }`. `SuggestionOut` carries `address`, `hash_code`, `score` (hash_code, not taxlot_id — AllClear identifier).
  - Keep pg_trgm `func.similarity` ordering as a tiebreaker on the parsed-field query.
- Extract shared constants. Move `PROMOTE_THRESHOLD`, `SUGGEST_THRESHOLD`, `PROMOTE_MARGIN`, `MAX_SUGGESTIONS` from `parcels.py` into `app/services/address_normalizer.py` (or new `app/services/address_search_constants.py`) so both routers reference the same values.

**Tests** (`backend/tests/test_allclear_parcels_search.py`, new):

- Exact match returns single parcel
- Suffix variant: "455 Siskiyou Boulevard" matches stored "455 SISKIYOU BLVD"
- Directional variant: "North Main" matches "N MAIN"
- No-number street search returns up to 10 partial matches
- Typo with strong winner promotes to a parcel hit, not a suggestion
- Typo with weak/ambiguous match returns suggestions list, empty parcels list
- Address with no number AND no street tokens returns `{parcels: [], suggestions: []}`
- Owner+occupant duplicates: assert both rows present (or deduped, depending on Open Question #2)

### Increment 2 — Extract reusable parcel-search UX shell

Create a presentational `<ParcelSearchPanel>` that owns the form, status banners, suggestions list, disambiguation list, and auto-select wiring, decoupled from Mapbox and from any specific result shape.

- New `frontend/src/components/ParcelSearchPanel.tsx` with prop contract:

  ```ts
  type SearchEnvelope<TResult, TSuggestion> = {
    parcels: TResult[]
    suggestions: TSuggestion[]
  }
  type ParcelSearchPanelProps<TResult, TSuggestion> = {
    initialAddress?: string
    placeholder?: string
    submitLabel?: string                        // default "Search"
    inputAriaLabel: string
    searchFn: (address: string) => Promise<SearchEnvelope<TResult, TSuggestion>>
    queryKey: string                            // e.g. "parcels" or "allclear-parcels"
    getResultAddress: (r: TResult) => string
    getResultKey: (r: TResult) => string
    getSuggestionAddress: (s: TSuggestion) => string
    getSuggestionKey: (s: TSuggestion) => string
    renderResultMeta?: (r: TResult) => React.ReactNode
    onSelect: (r: TResult) => void              // called for both auto-select and click
    autoSelectSingle?: boolean                  // default true
    inputClassName?: string
    formClassName?: string
    listClassName?: string
    notFoundMessage?: string
  }
  ```

- Lift verbatim from `AddressSearch.tsx`: form markup, input/state, `useQuery` wiring, `autoSelectedRef` logic, suggestion-click handler, `handleSelect`, `StatusBanner` error variants, "Did you mean…?" block, no-results warning, multi-result list. Drop everything Mapbox-specific.
- Refactor `AddressSearch.tsx` to be a thin wrapper that calls `<ParcelSearchPanel>` with map-page wiring: `searchFn={fetchParcels}`, `onSelect={(p) => { showParcelOnMap(map, p); onParcelSelected?.(p) }}`. Mapbox dependency stays inside `AddressSearch.tsx`.

**Tests** (`ParcelSearchPanel.test.tsx`, new): use `fireEvent`, mock `searchFn` directly.

- Renders form with input + button
- Submits and calls `searchFn` once with trimmed address
- Auto-selects only result and calls `onSelect`
- Renders disambiguation list when 2+ results; click → `onSelect`
- Renders "Did you mean…?" suggestions when parcels empty + suggestions non-empty
- Renders not-found warning when both empty
- Renders `StatusBanner` error variants (gis_unavailable, network_error, generic)
- Honors `autoSelectSingle={false}`

**A11y:**

- Preserve all aria attributes from `AddressSearch.tsx`. Add `useId()`-derived prefixes to IDs so the panel can render twice on the same page without collision.
- Add `aria-live="polite"` and `aria-busy={isFetching}` on the wrapping result-region so async result/suggestion arrival is announced without focus moving.
- When `autoSelectSingle={false}` and a single result lands, do not steal focus.
- Verify all interactive elements still meet 44px minimum.

### Increment 3 — Wire prepare page to use the new panel

Replace the ad-hoc form in `prepare.tsx`'s `SamaritanFlow` with `<ParcelSearchPanel>` driving the upgraded AllClear endpoint.

- Modify `frontend/src/lib/allclearApi.ts`:
  - Add `AllClearSuggestion`: `{ address: string; hash_code: string; score: number }`
  - Change `searchParcels` return type to `Promise<{ parcels: AllClearParcel[]; suggestions: AllClearSuggestion[] }>`
- Modify `frontend/src/routes/prepare.tsx`:
  - Replace inline form/results JSX in `SamaritanFlow` with `<ParcelSearchPanel<AllClearParcel, AllClearSuggestion>>`.
  - Props: `searchFn={searchParcels}`, `queryKey="allclear-parcels"`, `placeholder="e.g. 455 Siskiyou Blvd"`, `submitLabel="Find My Property"`, `inputAriaLabel="Your Ashland property address"`, `getResultAddress={(p) => p.situs_address ?? ''}`, `getResultKey={(p) => p.hash_code}`, `getSuggestionAddress={(s) => s.address}`, `getSuggestionKey={(s) => s.hash_code}`, `renderResultMeta={(p) => <span className="result-meta">{p.owner_name}{p.acreage ? ' · ' + p.acreage + ' ac' : ''}{p.role === 'owner' ? ' · Owner' : ' · Occupant'}</span>}`, `onSelect={(p) => navigate({ to: '/survey/$hashCode', params: { hashCode: p.hash_code } })}`, `autoSelectSingle={false}` (per Open Question #3), `formClassName="search-form prepare-search"`, `inputClassName="search-input prepare-input"`, `listClassName="search-results prepare-results"`.
  - Remove now-unused state/query/handlers.
- CSS: confirm `prepare-results` and `search-results` styling stack cleanly. If they conflict, add a `.prepare-page .search-results` override scope rather than editing the new component.

**Tests** (`prepare.test.tsx`):

- Renders search form with prepare-specific copy
- Typing + submitting with multi-result response renders all results with owner/occupant meta
- Clicking a result calls navigate with right `hash_code` (mock `@tanstack/react-router`)
- Single-result response does NOT auto-navigate (`autoSelectSingle={false}` honored)
- Suggestions render when API returns `parcels: [], suggestions: [...]`; clicking re-runs search
- Not-found message renders when both arrays empty

**A11y:**

- Smoke-test with VoiceOver/NVDA that submitting "455 Siskiyou Blvd" announces "5 results" via the new aria-live region
- Tab order preserved: input → submit → first result button → next result button → …
- "I'm a Resident" / "I'm an HOA" toggle remains reachable via Shift+Tab from input

### Increment 4 — Coverage-gap fallback (CONDITIONAL)

Only build if Open Question #1 reveals AllClear DB has meaningful gaps (< 95% coverage).

- When AllClear returns zero parcels AND zero suggestions, fall back to the same Ashland GIS Taxlots query `routers/parcels.py` uses, return those hits flagged with `coverage: "gis_only"` and `null` hash_code. Frontend shows an explanatory state ("We found that address in Ashland's records, but it's not yet in our preparedness database — please contact us to add it.") instead of silent "no properties found".
- Likely refactor: factor GIS lookup out of `routers/parcels.py` into `app/services/parcel_lookup.py` so both routers share it.

Skip if AllClear coverage is complete.

### Testing Strategy

- **Backend pytest:** new `test_allclear_parcels_search.py` covers parsed-field, suffix, directional, fuzzy-fallback, promote, and suggest paths against fixture-loaded SQLite or test Postgres (mirror `test_plant_entry_router.py` conftest pattern). Existing `test_address_normalizer.py` already covers the normalizer; we reuse it, not modify it. Run `test_parcels.py` as regression after constants extraction.
- **Frontend vitest:** `ParcelSearchPanel.test.tsx` is the load-bearing suite. `prepare.tsx` test focuses on wiring + navigation. Keep `AddressSearch.test.tsx` intact; if it breaks post-refactor, fix the wrapper not the panel test.
- **Integration smoke:** `./scripts/validate.sh` after each increment. Manually exercise `/prepare` with: exact match, misspelled street, suffix variant, typo with no good match, non-Ashland address.

### Risks

- **AllClear DB coverage** — see Open Question #1. Blocking.
- **Constants drift** if we don't share thresholds across routers — mitigated by shared-module step in Increment 1.
- **CSS class collision** — `prepare-results` markup may differ from extracted panel; visual diff before merging Increment 3.
- **Test DB for AllClear router** — if conftest only spins up SQLite, `func.similarity` (pg_trgm) won't work. New router uses ILIKE for the primary path (SQLite-compatible) and only uses `func.similarity` as a tiebreaker — verify the test setup either skips the tiebreaker on SQLite or runs against a Postgres test container.
- **No new dependencies.** `rapidfuzz` already in backend deps; no additions needed.

## Learnings

[to be filled in by Claude after implementation]
