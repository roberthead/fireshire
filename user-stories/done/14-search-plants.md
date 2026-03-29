# Filter list of matching plants

AS a user
WITH an address selected
WHEN I type into a search box at the top of the plants panel
I WANT to see a filtered list of the matches
AND I want the count to say "Y of X" instead of just "X" (where X is the count of API query results and Y is the filtered count that match the search term)

## Notes

All data about the plant should be in the text being searched, not just the name.

## Implementation Plan

### Approach

Client-side text filtering on the already-fetched plant data. The `PlantPanel` already receives plants from the API with `commonName`, `genus`, `species`, and attribute `values[]` (each with `attributeName` and `resolved.value`). Filtering happens instantly in the browser — no additional API calls needed.

The search input is debounced state inside `PlantPanel`. The "Y of X" count compares the search-filtered list against the zone-filtered list.

### Step 1: Add search utility function

**File: `frontend/src/lib/plantSearch.ts`** (new)

```typescript
export function plantMatchesSearch(plant: Plant, query: string): boolean
```

- Lowercase the query once
- Check if query appears (as substring) in any of:
  - `plant.commonName`
  - `plant.genus`
  - `plant.species`
  - Each `plant.values[].attributeName`
  - Each `plant.values[].resolved.value` (only string values)
- Return `true` if any field matches
- Empty query returns `true` (show all plants)

**File: `frontend/src/lib/plantSearch.test.ts`** (new)

- Matches on commonName
- Matches on genus
- Matches on species
- Matches on attribute resolved.value
- Case-insensitive matching
- Empty query matches everything
- No match returns false

### Step 2: Add search input to PlantPanel

**File: `frontend/src/components/PlantPanel.tsx`** (edit)

Changes:
1. Add `searchQuery` state (`useState('')`)
2. Add a search `<input>` in the header area, below the title row, styled consistently:
   - Use the existing `.search-input` CSS class patterns (dark background, light text, focus ring)
   - Inline styles matching the frosted glass theme: `background: rgba(255,255,255,0.1)`, `border: 1px solid rgba(255,255,255,0.2)`, `color: var(--color-text)`, full width of panel
   - Placeholder: `"Search plants..."`
   - `min-height: 36px` (slightly smaller than the main search bar's 44px since it's a secondary filter)
3. After the existing zone filtering (`filteredPlants`), apply search filter:
   ```typescript
   const searchedPlants = searchQuery
     ? filteredPlants.filter(p => plantMatchesSearch(p, searchQuery))
     : filteredPlants
   ```
4. Update the count badge: show `searchedPlants.length` when there's no search query (current behavior), or `"${searchedPlants.length} of ${filteredPlants.length}"` when `searchQuery` is non-empty
5. Render `searchedPlants` instead of `filteredPlants` in the list
6. Update the "Showing X of Y" pagination footer similarly

### Step 3: Update PlantPanel tests

**File: `frontend/src/components/PlantPanel.test.tsx`** (edit)

Add tests:
- Search input filters displayed plants by common name
- Search input filters by genus/species
- Count displays "Y of X" format when searching
- Clearing search shows all zone-filtered plants again

### Step 4: Validate

- Run `./scripts/validate.sh`

---

### Test Plan Summary

| Layer | What | How |
|-------|------|-----|
| Frontend unit | plantMatchesSearch utility | Vitest — field matching, case insensitivity |
| Frontend unit | PlantPanel search filtering | Vitest + Testing Library — input, filtered list, count format |
| Integration | Search within zone-filtered plants | Manual via dev servers |

## Learnings

### LWF API Null Fields
- The LWF plants API returns `null` for `commonName`, `genus`, and `species` on some plants. Any code that calls `.toLowerCase()` or renders these fields must use optional chaining (`?.`) or fallbacks (`?? ''`, `|| 'Unknown'`). This applies to both search logic and JSX rendering.

### Mapbox GL + React State Changes
- Any Mapbox GL API call that touches layers/sources (`getLayer`, `getSource`, `addSource`, `setLayoutProperty`) accesses `map.style` internally. When `map.style` is transiently `undefined` (during teardown or React Strict Mode double-invocation), these calls throw `Cannot read properties of undefined (reading 'getOwnLayer')`.
- The fix: wrap entire `useEffect` bodies that interact with Mapbox in try/catch, and guard `addSource`/`addLayer` with existence checks (`!map.getSource(id)`) to handle React Strict Mode's effect double-invocation gracefully.
- This is a pre-existing fragility that surfaced because adding state to a sibling component (PlantPanel search input) triggered re-renders that exposed the race condition.
