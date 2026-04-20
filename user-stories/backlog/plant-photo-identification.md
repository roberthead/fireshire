# Story: Identify Plants from Photos via PlantNet

## Summary

AS a homeowner viewing my property
ON the map view
I WANT to upload a photo of a plant and have it identified
SO THAT I can learn whether my existing plants are fire-resilient for their zone

## Acceptance Criteria

- User can upload or capture a photo of a plant
- User can specify what zone(s) the plant is in
- Photo is sent to the PlantNet API (`POST https://my-api.plantnet.org/v2/identify/all`) for identification
- Top species suggestions are displayed with common name, scientific name, and confidence score
- If a match is found in the LWF/HIZ plant dataset, show its fire-zone suitability (recommended zones, fire-resistance rating)
- If the plant is not in the LWF dataset, indicate that no fire-resilience data is available
- User sees a clear loading state while identification is in progress
- Graceful error handling if the photo is unclear or no match is found

## Notes

- PlantNet free tier: 500 identifications/day (no cost, no credit card)
- API key from my.plantnet.org, passed as query param `?api-key=KEY`
- Organ hint (`leaf`, `flower`, `fruit`, `bark`, `auto`) improves accuracy — consider letting user select or defaulting to `auto`
- Must display "Powered by Pl@ntNet" attribution on free tier
- Backend should proxy the PlantNet call to keep the API key server-side
- Cross-reference identified species against LWF plant data by common name and/or scientific name

## Implementation Plan

### 0. Setup — PlantNet API Key

1. Sign up at https://my.plantnet.org/signup
2. Generate an API key at https://my.plantnet.org/settings/api-key
3. Add `PLANTNET_API_KEY=<key>` to `backend/.env` for local dev
4. Add `PLANTNET_API_KEY` as an environment variable in Vercel project settings
5. Verify with a quick curl test:
   ```bash
   curl -X POST 'https://my-api.plantnet.org/v2/identify/all?api-key=YOUR_KEY&nb-results=1' \
     -F 'images=@test-photo.jpg' -F 'organs=auto'
   ```

### 1. Backend — PlantNet Proxy Client

**New file:** `backend/app/services/plantnet_client.py`

- Create `PlantNetError(Exception)` with `detail` field (mirrors `PlantsApiError` / `GISServiceError` pattern)
- Create `PlantNetClient` class:
  - `__init__`: instantiate `httpx.AsyncClient` with `Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0)` (longer read timeout — PlantNet can be slow)
  - `close()`: close the httpx client
  - `async identify(image_bytes: bytes, content_type: str, organ: str = "auto") -> dict`:
    - POST `https://my-api.plantnet.org/v2/identify/all` as multipart/form-data
    - Query params: `api-key` from env, `lang=en`, `nb-results=5`, `no-reject=false`
    - Form fields: `images` (file tuple), `organs` (matching organ value)
    - Handle errors: 404 → "not a plant or no match", 429 → "daily quota exceeded", 401 → config error
    - Return parsed JSON response
- API key: `PLANTNET_API_KEY` env var (loaded via `os.environ.get` like `ANTHROPIC_API_KEY`)

### 2. Backend — Identification Endpoint

**New file:** `backend/app/routers/plantnet.py`

- `POST /plantnet/identify`
  - Accepts `multipart/form-data`: `image: UploadFile` (required), `organ: str = "auto"`, `zones: str` (comma-separated zone strings like `"0-5,5-10"`)
  - Validates: file is JPEG or PNG, size ≤ 10 MB
  - Calls `plantnet_client.identify()`
  - Maps response to a simplified result shape:
    ```python
    {
      "suggestions": [
        {
          "score": 0.91,
          "scientificName": "Ajuga genevensis",
          "commonNames": ["Blue bugleweed"],
          "genus": "Ajuga",
          "family": "Lamiaceae",
          "gbifId": 2927079,
        }
      ],
      "remainingQuota": 498,
      "organDetected": "flower"
    }
    ```
  - Does NOT cross-reference LWF data server-side — the frontend already has plant data loaded and can match by name

**Register in `main.py`:**
- Import router, add `app.include_router(plantnet.router)`
- Add `PlantNetError` exception handler → 503 with `{"error": "plantnet_unavailable", "detail": ...}`
- Initialize/close `PlantNetClient` in app lifespan

### 3. Frontend — API Layer

**Edit:** `frontend/src/lib/api.ts`

- Add `PlantNetSuggestion` type and `IdentifyResult` type matching the backend response shape
- Add `identifyPlant(image: File, organ: string, zones: string[]): Promise<IdentifyResult>` function:
  - Build `FormData` with image file, organ, zones
  - POST to `/api/plantnet/identify`
  - Parse response with `ApiError` handling

### 4. Frontend — LWF Cross-Reference Matching

**New file:** `frontend/src/lib/plantMatch.ts`

Two-stage matching of PlantNet suggestions against loaded LWF plant data:

1. **Exact match** — case-insensitive comparison of:
   - PlantNet `scientificName` (genus + species) vs LWF `genus` + `species`
   - PlantNet `commonNames[]` vs LWF `commonName`
2. **Fuzzy match** (only if exact match fails) — normalized token-based comparison:
   - Strip punctuation, lowercase, split into tokens
   - Match if all tokens from the shorter name appear in the longer name (e.g., "Blue Bugle" matches "Blue Bugleweed")
   - Genus-only match as fallback (e.g., PlantNet says "Ajuga genevensis", LWF has "Ajuga reptans" — flag as same-genus partial match)

Returns: `{ match: Plant | null, matchType: 'exact' | 'fuzzy' | 'genus' | 'none' }`

### 5. Frontend — Photo Upload UI

**New file:** `frontend/src/components/PlantIdentifier.tsx`

- Renders inside `PlantPanel` as a new third tab (alongside "Plants" and "Chat")
- Single photo upload (one image per identification):
  - Drop zone / file input for photo (accepts `image/jpeg, image/png`)
  - Camera capture button (`<input accept="image/*" capture="environment">`) for mobile
  - Image preview thumbnail after selection
- Organ selector: radio buttons or segmented control (`auto`, `leaf`, `flower`, `fruit`, `bark`)
- Zone selector: four buttons `[0–5 ft] [5–10 ft] [10–30 ft] [30–100 ft]`, multi-select, pre-populated from active zone visibility in MapContext
- "Identify" submit button
- Uses `useMutation` from TanStack Query for the upload
- Loading state: spinner + "Identifying plant..." text
- Error states: not a plant (404), quota exceeded (429), upload too large, network error

**Future enhancement (not V1):** Click a location on the map to auto-determine the zone and initiate the upload flow from there.

### 6. Frontend — Results Display

**Within `PlantIdentifier.tsx`:**

- Show ranked suggestions (up to 5) after successful identification:
  - Confidence score as percentage bar
  - Scientific name (italic) + common names
  - Family / genus info
- For each suggestion, run two-stage cross-reference (step 4) against loaded LWF plant data:
  - **Exact/fuzzy match:** show zone badges + fire-zone suitability from LWF data, with link/scroll to that plant in the Plants tab
  - **Genus match:** show "Same genus found in fire-resilient database" with the genus-matched LWF plant(s)
  - **No match:** show "No fire-resilience data available for this species"
- User-specified zones shown alongside LWF-recommended zones for comparison (e.g., "You placed this in Zone 3 (10–30 ft) — this plant is recommended for zones 2, 3")
- "Powered by Pl@ntNet" attribution (required for free tier)

### 7. Styling

- Reuse glass-morphic panel pattern (`rgba(0,0,0,0.55)` + `backdrop-filter: blur(12px)`)
- Image preview: 120px thumbnail with rounded corners
- Confidence bars: colored gradient (green for high, yellow for medium, red for low)
- Zone badges: reuse existing zone badge styling from `PlantPanel`
- Drop zone: dashed border, hover highlight, drag-and-drop feedback
- Responsive: full-width on mobile (<768px), 320px panel width on desktop

### Test Plan

**Backend tests** (`backend/tests/`):

- `test_plantnet_client.py`:
  - Mock httpx responses for successful identification, 404 rejection, 429 quota, 500 error
  - Verify multipart form construction (image bytes, organ, API key)
  - Verify response parsing into simplified shape
- `test_plantnet_router.py`:
  - POST with valid JPEG → 200 with suggestions
  - POST with non-image file → 400 validation error
  - POST with oversized file → 400 validation error
  - PlantNet service down → 503 with error detail
  - Missing API key configured → appropriate error

**Frontend tests** (`frontend/src/`):

- `lib/__tests__/plantMatch.test.ts`:
  - Exact scientific name match (case-insensitive)
  - Exact common name match
  - Fuzzy match: subset tokens ("Blue Bugle" matches "Blue Bugleweed")
  - Genus-only match when species differs
  - No match returns `{ match: null, matchType: 'none' }`
- `components/__tests__/PlantIdentifier.test.tsx`:
  - Renders file input, organ selector, zone buttons, identify button
  - File selection shows preview thumbnail
  - Submit sends FormData to correct endpoint
  - Loading state shown during identification
  - Successful response renders suggestions with scores and names
  - LWF exact match shows zone badges
  - LWF fuzzy match shows zone badges with match type indicated
  - LWF genus match shows "same genus" message
  - No match shows "no data" message
  - Error states render appropriate messages (not a plant, quota exceeded)
  - "Powered by Pl@ntNet" attribution visible

## Learnings

[to be filled in by Claude after implementation]
