# Story: Flexible Address Matching

## Summary

AS a resident searching for my property
ON the FireShire map page
I WANT the address search to tolerate common variations and typos
SO THAT I'm not blocked by a strict substring match against the city's address spelling

## Acceptance Criteria

- `2770 Diane St` (current canonical match) continues to work
- `2770 Diane Street` (suffix variant) finds the same parcel
- `2770 Dianne St` (single-letter typo) finds the same parcel
- Other common variants work: `2770 DIANE ST.`, `2770 N Main Avenue` ↔ `2770 N MAIN AVE`, leading/trailing whitespace
- When the input cannot be confidently matched, the API returns ranked suggestions the UI can show as "Did you mean…?"
- A single-quote in user input does not break the SQL query (current `LIKE '%{normalized}%'` is interpolated and is an injection vector)
- Existing parcel-router tests still pass; new tests cover suffix normalization, fuzzy fallback, and SQL escaping

## Notes

Current implementation: `backend/app/routers/parcels.py` runs a single ArcGIS query

```sql
UPPER(SITEADD) LIKE '%<normalized input>%'
```

against the Taxlots FeatureServer. The taxlot layer also exposes `ADDRESSNUM` and `STREETNAME` as discrete fields, which enables a more selective query (`ADDRESSNUM = 2770 AND STREETNAME LIKE 'DIANE%'`) and a cheap fuzzy fallback.

Recommended layered approach:

1. **Suffix & directional normalization** — map `STREET|STR|ST.` → `ST`, `AVENUE|AVE.` → `AVE`, `BOULEVARD|BLVD.` → `BLVD`, `NORTH|N.` → `N`, etc. (USPS suffix list, ~30 entries). Fixes the `Street` case.
2. **Parse into number + street, query separately** against `ADDRESSNUM` and `STREETNAME`. More selective; sets up step 3.
3. **Fuzzy fallback when zero hits** — fetch candidates by `ADDRESSNUM` (usually <10 rows on a street), rank with `rapidfuzz` (Levenshtein/Jaro-Winkler). Return top match if score > threshold (e.g. 85), otherwise return ranked suggestions.
4. **SQL escape** — quote single-quotes (`'` → `''`) before interpolating into the ArcGIS `where` clause.

Out of scope for this story (defer): pg_trgm-backed local index, autocomplete UI, phonetic (Soundex/Metaphone) matching.

## Implementation Plan

### Overview

Replace the single `UPPER(SITEADD) LIKE '%input%'` query with a layered match strategy: (1) parse the input into `ADDRESSNUM` + street tokens with USPS suffix/directional normalization, (2) query the discrete `ADDRESSNUM`/`STREETNAME` fields with safely-escaped values, (3) on zero hits fall back to a `rapidfuzz` ranking against all parcels sharing the house number. The API keeps its existing `parcels[]` shape and adds a sibling `suggestions[]` field that the UI surfaces only when there is no confident match.

### Decisions

**Response shape — add a separate `suggestions[]` field (do NOT reuse `parcels[]`).**

- `parcels[]` carries full geometry and triggers auto-select when length is 1. Folding fuzzy suggestions into it would either auto-fly to a wrong parcel on a typo, or force the auto-select logic to inspect a confidence flag — leaking match semantics into geometry data.
- A distinct `suggestions[]` lets the UI render a clearly-labeled "Did you mean…?" affordance without geometry payload.
- `parcels[]` continues to mean "confident matches; safe to render on the map."

**Drop `SITEADD LIKE` entirely; do not keep it as a first pass.**

- Parsed-field query (`ADDRESSNUM = '2770' AND UPPER(STREETNAME) LIKE 'DIANE%'`) is strictly more selective and uses indexed discrete fields.
- Edge case: inputs that don't parse cleanly (only a street name, no number) — handle by skipping the `ADDRESSNUM` predicate.

### Steps

1. **Add `rapidfuzz` dependency** — `backend/pyproject.toml`: add `"rapidfuzz>=3.9,<4.0"` to `[project].dependencies`. Run `poetry lock && poetry install`.

2. **Create address normalization module** — new file `backend/app/services/address_normalizer.py`:
   - `normalize_address(raw: str) -> str` (preserves existing uppercase + whitespace-collapse contract).
   - `parse_address(raw: str) -> ParsedAddress` returning `{"number": str | None, "street": str}` with suffix/directional tokens canonicalized.
   - `escape_sql_literal(value: str) -> str` doubling single-quotes (`'` → `''`).
   - Constants `SUFFIX_MAP` (USPS Pub 28: STREET/STR/ST.→ST, AVENUE/AVE.→AVE, BOULEVARD/BLVD.→BLVD, ROAD/RD.→RD, DRIVE/DR.→DR, LANE/LN.→LN, COURT/CT.→CT, PLACE/PL.→PL, CIRCLE/CIR.→CIR, WAY, TERRACE/TER, PARKWAY/PKWY, HIGHWAY/HWY, etc.) and `DIRECTIONAL_MAP` (NORTH/N.→N, etc.).

3. **Refactor `lookup_parcels` in `backend/app/routers/parcels.py`**:
   - Build `where` from parsed fields with escaped literals.
     - Number parsed: `ADDRESSNUM = '<num>' AND UPPER(STREETNAME) LIKE '<street>%'`.
     - No number: `UPPER(STREETNAME) LIKE '%<street>%'`.
   - On zero matches AND a number was parsed: second query `where=ADDRESSNUM = '<num>'`, `returnGeometry=false`. Score sibling `SITEADD` against original normalized input with `rapidfuzz.fuzz.WRatio`. Keep score ≥ 70, sort desc, take top 5.
   - When best score ≥ 85 AND no other candidate within 5 points, refetch winner WITH geometry and promote into `parcels[]`. Otherwise `parcels: []` plus `suggestions[]`.
   - Suggestion shape: `{"address": str, "taxlot_id": str, "score": int}`. No geometry.

4. **Update response model and types**:
   - Backend response always includes `suggestions: []` (empty when not used).
   - Frontend `frontend/src/lib/api.ts`: add `interface Suggestion { address: string; taxlot_id: string; score: number }`. Extend `ParcelResponse`.

5. **Render "Did you mean…?" in `frontend/src/components/AddressSearch.tsx`**:
   - When `parcels.length === 0 && suggestions.length > 0`, render a list using existing `.search-results` styling. Header: "Did you mean…?". Each `<button>` re-runs search with `suggestion.address`.
   - "We couldn't find that address" banner only when both `parcels` and `suggestions` are empty.

6. **Backend tests** (`backend/tests/test_parcels.py` + new `backend/tests/test_address_normalizer.py`):
   - Update `test_parcel_lookup_normalizes_address` to assert both `ADDRESSNUM = '570'` and `SISKIYOU` appear.
   - `test_suffix_normalization_street_to_st`, `test_suffix_normalization_avenue_to_ave`, `test_directional_normalization`.
   - `test_fuzzy_fallback_promotes_high_score`, `test_fuzzy_fallback_returns_suggestions`, `test_fuzzy_fallback_no_candidates`.
   - `test_sql_injection_single_quote_escaped` — `2770 O'Brien St` → URL contains `O''BRIEN`.
   - New unit file `test_address_normalizer.py` — table-driven cases on `parse_address` and `escape_sql_literal`.

7. **Frontend tests** (`AddressSearch.test.tsx`):
   - `renders did-you-mean list when suggestions present and parcels empty`.
   - `clicking a suggestion re-runs the search with that address`.
   - `does not show "no results" banner when suggestions are present`.

### Accessibility

- Suggestion list is a real `<ul>` with `<button>` children (matches existing `.search-results`).
- `aria-label="Suggested addresses"` on the `<ul>`.
- Visually-hidden `aria-live="polite"` so screen readers hear "Did you mean…" announcements.
- Do NOT auto-focus first suggestion.

### Risks and Open Questions

- **Two round-trips on no-match** — acceptable for the degraded branch.
- **`STREETNAME` field shape** — fixture has `"SISKIYOU BLVD"` (suffix included). If real rows differ, fall back to LIKE on base name only.
- **Fuzzy threshold tuning** — 85 promote / 70 suggest are starting points. If `Dianne` → `Diane` doesn't reach 85 with `WRatio`, switch to `token_set_ratio` or lower threshold.
- **Open question** — show "Showing matches for DIANE ST (you typed Dianne)" hint on auto-promotion? Defer.

## Learnings

[to be filled in by Claude after implementation]
