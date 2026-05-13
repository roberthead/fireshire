# Story: Address Search On Prepare

## Summary

AS a User
ON /prepare
I WANT to search for my address
SO THAT I can continue on to the map

## Acceptance Criteria

- The search results should succeed for any address in Ashland
- Fuzzy search
- Searching on `/` and `/prepare` must hit the same data source, run the same algorithm, and return the same matches — only the selection side effect differs

## Notes

The search on the map page (at `/`) already uses fuzzy search against the live ArcGIS Taxlots endpoint. This story unifies prepare onto that same path. After selection, `/prepare` resolves the chosen taxlot to an AllClear `Parcel` row via find-or-create, then navigates to `/survey/$hashCode`.

## Implementation Plan

### Overview

**Approach: truly unified search, two selection behaviors.** Both pages call the same backend endpoint (`GET /api/parcels`) hitting GIS Taxlots, render results through one shared frontend component, and apply the same fuzzy/promote/suggest logic via a shared backend service. The only divergence is at `onSelect`:

- Map page: pan and draw the parcel polygon (unchanged behavior).
- Prepare page: `POST /api/allclear/parcels/resolve` with the selected taxlot's attributes → server does find-or-create on `parcels` keyed by `(account, role='owner')` → returns `{ hash_code }` → frontend navigates to `/survey/$hashCode`.

This deletes the AllClear `/parcels/search` endpoint entirely (along with the pg_trgm-only query, the conditional GIS-fallback increment, and the coverage open question). Coverage matches GIS by construction.

The story also folds in three a11y debts in the same file (toggle buttons, autocomplete, focus management) and corrects an aria-live placement bug carried over from `AddressSearch.tsx`.

### Resolved Decisions

1. **`hash_code` generation for find-or-create.** ✅ Confirmed. Synthetic codes are `'g' + sha1(map_taxlot + ':owner').hexdigest()[:15]` (16 chars total). The `g` prefix distinguishes them from AllClear's upstream codes, which don't start with `g`. Deterministic and stable per taxlot.

2. **Owner+occupant rows on resolve.** ✅ Confirmed. `resolve` returns the `role='owner'` row. Occupant tracking deferred.

3. **Deletion of `/api/allclear/parcels/search`.** Deferred from Increment 1 to Increment 4 so the prepare page keeps working mid-stack until the frontend migrates.

### Increment 1 — Extract shared address-search algorithm (backend)

Pull the parse → query → score → promote-or-suggest routine out of `routers/parcels.py` into a service so the algorithm is shared and unit-testable in isolation.

- New `backend/app/services/address_search.py`:
  - Constants: `PROMOTE_THRESHOLD = 85`, `SUGGEST_THRESHOLD = 70`, `PROMOTE_MARGIN = 5`, `MAX_SUGGESTIONS = 5`.
  - `run_fuzzy_search(address, fetch_candidates, fetch_by_id, build_result)` — returns `{ parcels, suggestions }`. Callbacks abstract the data source so this service has no GIS or DB knowledge.
- Refactor `backend/app/routers/parcels.py` to a thin adapter calling `run_fuzzy_search` with GIS-specific fetcher callbacks. Behavior unchanged; all existing `test_parcels.py` tests pass.
- Leave the AllClear `/parcels/search` endpoint untouched in this increment so the prepare page keeps working. It is deleted in Increment 4 when the frontend migrates.

**Tests** (`backend/tests/test_address_search.py`, new): exercise `run_fuzzy_search` directly with a stub fetcher — covers the suggest/promote thresholds without GIS or DB. Existing `test_parcels.py` becomes the integration test for the GIS wiring; no new fixtures needed.

### Increment 2 — Resolve endpoint (backend)

Add `POST /api/allclear/parcels/resolve` so the frontend can convert a GIS taxlot selection into an AllClear `hash_code`.

- Request body: `{ map_taxlot: str, situs_address: str | None, owner_name: str | None, acreage: float | None }` (minimal fields needed for a usable parcel row; everything else stays null until enriched).
- Logic:
  1. `SELECT hash_code FROM parcels WHERE map_taxlot = :map_taxlot AND role = 'owner' LIMIT 1`
  2. If hit, return `{ hash_code }`.
  3. If miss, generate `hash_code = 'g' + sha1(map_taxlot + ':owner').hexdigest()[:15]`, INSERT row with `role='owner'`, `account=map_taxlot` (fallback), `city='ASHLAND'`, return `hash_code`.
  4. Wrap in transaction; on `IntegrityError` (concurrent insert race), re-`SELECT`.
- Schema: `ParcelResolveIn`, `ParcelResolveOut` in `routers/allclear.py`.

**Tests** (`backend/tests/test_allclear_parcels_resolve.py`, new):
- Existing parcel: returns existing `hash_code`, doesn't insert.
- New taxlot: inserts with synthetic `g...` hash; row visible in DB.
- Idempotency: two consecutive calls with same input return same hash, row count unchanged.
- Owner+occupant both present: returns owner's hash, not occupant's.
- Concurrent-insert race: simulate by inserting between the SELECT and INSERT — endpoint must return the racing row's hash, not 500.

### Increment 3 — Unify the frontend address search component

Replace `AddressSearch.tsx` and the inline `SamaritanFlow` search with a single shared component. Normalize at the API-client boundary so the component is non-generic.

- API-boundary view model in `frontend/src/lib/api.ts`:

  ```ts
  type SearchResult = { id: string; address: string; meta?: ReactNode; raw: Parcel }
  type SearchSuggestion = { id: string; address: string }
  type SearchEnvelope = { parcels: SearchResult[]; suggestions: SearchSuggestion[] }
  ```

  `fetchParcels` adapts the GIS `Parcel` shape into `SearchResult` once: `{ id: parcel.taxlot_id, address: parcel.address, raw: parcel }`. Optional `meta` lets the map page show `(2.3 ac)` if desired.

- Refactored `frontend/src/components/AddressSearch.tsx` becomes a non-generic presentational component:

  ```ts
  type AddressSearchProps = {
    initialAddress?: string
    placeholder?: string
    submitLabel?: string
    inputAriaLabel: string
    searchFn: (address: string) => Promise<SearchEnvelope>
    queryKey: string
    onSelect: (result: SearchResult) => void | Promise<void>
    autoSelectSingle?: boolean   // default true
    emptyHint?: string           // shown under input before any search
    notFoundMessage?: string
  }
  ```

  ~5 props instead of 14. Map-page wiring stays inline at the call site; no separate "panel" abstraction.

- The Mapbox `showParcelOnMap` helper moves to `frontend/src/lib/mapHelpers.ts` and is called from the map route's `onSelect` callback, not from inside `AddressSearch`. The component no longer touches `useMapContext`.

**Tests** (`AddressSearch.test.tsx`, rewritten): mock `searchFn` directly with `fireEvent`. Cover: form submission, trim, auto-select, disambiguation click, suggestion click, error variants, empty state, `autoSelectSingle={false}`.

**A11y** (corrections to the existing component, applied during extraction):

- Move `aria-live` OFF the result `<ul>`. Add a separate visually-hidden announcer (`role="status"` + `aria-live="polite"` + `aria-atomic="true"`) that receives a *summary* string like "5 properties found" or "No matches; did you mean Siskiyou Boulevard?" — set once when `isFetching` flips false. Keep `aria-busy={isFetching}` on the form region.
- Add `useId()`-derived ID prefixes for `suggestions-heading` and the announcer so two instances can mount without collision.
- Add `autocomplete="street-address"` to the input (WCAG 1.3.5).
- On suggestion click (re-search): move focus back to the input, not lost when the suggestion button unmounts.
- Wire `aria-invalid` + `aria-describedby` on the input for input-related errors (too-short / no-match); leave network errors as standalone alerts.
- `autoSelectSingle={false}` + single result: do not steal focus.
- 44px minimum touch targets on result buttons (already met; verify post-extraction).

### Increment 4 — Wire prepare page

Replace `SamaritanFlow`'s inline form with the shared `<AddressSearch>` driving the GIS endpoint and the resolve endpoint.

- Delete `searchParcels` from `frontend/src/lib/allclearApi.ts`. Add `resolveParcel(input: { map_taxlot, situs_address, owner_name, acreage }): Promise<{ hash_code: string }>`.
- Modify `frontend/src/routes/prepare.tsx` `SamaritanFlow`:

  ```tsx
  <AddressSearch
    searchFn={fetchParcels}
    queryKey="parcels"
    placeholder="e.g. 455 Siskiyou Blvd"
    submitLabel="Find My Property"
    inputAriaLabel="Your Ashland property address"
    autoSelectSingle={false}
    emptyHint="We cover properties inside Ashland city limits."
    onSelect={async (result) => {
      const { hash_code } = await resolveParcel({
        map_taxlot: result.raw.taxlot_id,
        situs_address: result.address,
        owner_name: result.raw.owner,
        acreage: result.raw.acreage,
      })
      navigate({ to: '/survey/$hashCode', params: { hashCode: hash_code } })
    }}
  />
  ```

- Remove inline state/query/handlers and the now-dead AllClear search wiring.
- CSS: unify into a single `.address-search` / `.address-search__results` scope on the component. Delete the `.prepare-results` class. Map page picks up the same styling; if visual regressions appear, fix at the component level, not via per-route overrides.
- Fix the prepare-page toggle buttons (same file, same story): add `role="group"` + `aria-label="Choose your role"` to `.prepare-toggle`, and `aria-pressed={mode === 'samaritan'}` to each toggle button (WCAG 1.3.1, 4.1.2).
- `/survey/$hashCode` route on mount: focus the `<h1>` with `tabIndex={-1}` so keyboard users land on the right context after navigation (WCAG 2.4.3). Separate small change in `frontend/src/routes/survey.$hashCode.tsx`.
- "Did you mean…?" behavior on prepare: clicking a suggestion populates the input but does NOT auto-submit. User re-presses "Find My Property". (Map page can keep its current auto-research; prop-controllable if needed, but defer.)

**Tests** (`prepare.test.tsx`, new):
- Renders shared search with prepare-specific copy + emptyHint.
- Multi-result response renders all rows; clicking one calls `resolveParcel` with the right taxlot, then navigates with the returned `hash_code`.
- Single-result does NOT auto-navigate (`autoSelectSingle={false}` honored).
- Suggestions render and populate input on click without auto-submit.
- Resolve failure surfaces the error banner.
- Toggle buttons: keyboard reaches each, `aria-pressed` flips with state.

### Testing Strategy

- **Backend pytest:** new `test_address_search.py` (stub fetcher, unit) + new `test_allclear_parcels_resolve.py` (Postgres, find-or-create + race) + existing `test_parcels.py` as regression. The conftest already uses Postgres; no SQLite/pg_trgm caveats.
- **Frontend vitest:** rewritten `AddressSearch.test.tsx` is the load-bearing suite. `prepare.test.tsx` covers wiring. Map route test only needs to assert `onSelect` calls `showParcelOnMap`.
- **Manual smoke:** `./scripts/validate.sh`, then exercise both routes with: exact match, misspelled street, suffix variant, typo with strong winner, typo with weak/ambiguous match, single-result, multi-result, non-Ashland address. Verify keyboard-only flow on prepare + survey landing focus.

### Risks

- **Hash collision with future AllClear seed data.** Mitigated by the `g` prefix (Open Question #1). If AllClear ever ships codes starting with `g`, we re-prefix.
- **Resolve endpoint write amplification.** Every prepare-page selection writes a row if not already present. Acceptable — single INSERT per first-touch parcel, hot path is the SELECT.
- **CSS regression on the map page.** Unifying classes risks visual diff. Compare before/after screenshots of the map search box; fix at component level.
- **TanStack Router test harness.** `prepare.test.tsx` doesn't exist; the route needs `createMemoryHistory` + `RouterProvider` boilerplate. Mirror whatever existing route tests do (check `frontend/src/routes/__tests__/` for a pattern).

## Learnings

- **Separate functionality from UX.** Address search is one feature; "what happens after you pick a result" is a surface-specific UX choice. Unifying on a single backend path (`GET /parcels`) and a single non-generic `<AddressSearch>` component, with each route passing its own `onSelect` (map fly-to vs. resolve-and-navigate), removed both code duplication AND the entire class of bugs where two surfaces drift in coverage or behavior. The two halves had been entangled because they shared *neither* the data source nor the algorithm — once we unified the data source, the rest fell out for free.
- **The user's "should both pages use the same lookup code?" question reframed the problem.** Before that, the plan was bringing the AllClear DB endpoint to parity with the GIS endpoint (same algorithm, two data sources). The reframe — both routes hit GIS, prepare does `resolve` find-or-create afterward — eliminated Open Question #1 (DB coverage), the conditional Increment 4 (GIS fallback), and most of the original increment-1 backend work. Worth re-questioning the architecture before implementing parity-flavored work.
- **Pre-implementation multi-agent plan review caught real over-engineering.** The original plan had a 14-prop generic `ParcelSearchPanel<TResult, TSuggestion>`. Developer and best-practices reviewers independently flagged it as premature abstraction; the synthesis (normalize at the API-client boundary with `SearchResult { id, address, meta?, raw }`) collapsed it to ~5 props with no generics on the component. Reviewer fan-out before coding is cheap; refactoring entangled abstractions after the fact is not.
- **Extract the algorithm, not just the constants.** The original plan only proposed sharing `PROMOTE_THRESHOLD` etc. Reviewers correctly pointed out the ~60-line promote/suggest routine would diverge. `services/address_search.py:run_fuzzy_search` with callback fetchers (`fetch_primary`, `fetch_siblings`, `fetch_by_id`, `id_key`) is unit-testable against stubs in 9 tests with no GIS or DB, and the GIS adapter shrank to 3 fetcher functions.
- **`aria-live` placement is load-bearing.** Putting `aria-live="polite"` on the result `<ul>` would have re-announced all 5 rows on every refetch (every keystroke if `enabled` were live). The fix — separate `sr-only` announcer that receives only a *summary string* ("5 properties found", "No matches found.") — is a small a11y win that's easy to miss without a specialist review.
- **Announcer text must differ from visible banner text.** Initial implementation made the announcer say the full not-found copy. `findByText` then matched two elements (announcer + StatusBanner) and the test failed. Differentiating to a concise summary fixed both the test ambiguity and the AT verbosity. Generally: text duplicated between sr-only and visible regions is a smell.
- **`g`-prefix synthetic hashes are a cheap collision-avoidance trick.** AllClear's upstream codes happen not to start with `g`, so `'g' + sha1(map_taxlot + ':owner').hexdigest()[:15]` is collision-free *now* and easy to re-prefix later if that ever changes. Deterministic per `(map_taxlot, role)` so idempotency falls out of the math, not out of locking.
- **TanStack Router auto-scans `src/routes/`.** Tests placed there must be prefixed with `-` (e.g. `-prepare.test.tsx`) to be excluded from the route tree. The warning is harmless but noisy.
- **Find-or-create + `IntegrityError` retry pattern.** The resolve endpoint races on (`SELECT` → `INSERT`); under contention the second writer hits a PK conflict, rolls back, re-`SELECT`s, and returns the winning row. Cleaner than a transactional advisory lock and good enough at our scale.
- **Migrating the dead endpoint's last consumer was a quiet trap.** Deleting `/api/allclear/parcels/search` broke `ZoneSummary.tsx`, which used `searchParcels` for its own save-flow address-to-hash lookup. The fix was the same migration (use `resolveParcel`) and turned out to give the map page the same coverage parity for free. Lesson: grep callers before deleting an API.
