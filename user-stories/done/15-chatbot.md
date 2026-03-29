# Story: Fire-Resilient Landscaping Chatbot

## Summary

AS a homeowner in Ashland
WITH my property's fire zone overlay displayed
I WANT to ask questions in a chat panel about fire-resilient landscaping
SO THAT I can get personalized guidance on plant selection, zone management, and defensible space practices for my specific property

## Acceptance Criteria

- A chat toggle button appears in the UI (e.g., bottom-right corner or as a panel tab)
- Opening chat reveals a message panel with an input field
- User can type natural language questions and receive streamed responses
- The chatbot has context about:
  - The user's active address and parcel data (if loaded)
  - The fire zone model (Zone 1–4 distances and purposes)
  - Plants currently shown in the plant panel (filtered by active zones)
  - General CAL FIRE / IBHS defensible space best practices
- Responses stream in real-time (not blocked until complete)
- Chat history persists within the session (cleared on page reload)
- Works on both desktop and mobile layouts

## Notes

- Uses Claude API directly from a FastAPI backend endpoint (API key stored server-side as environment variable `ANTHROPIC_API_KEY`)
- System prompt should ground the model in Ashland-specific fire-resilient landscaping context, zone definitions, and the plant data available in the app
- Send current property context (address, zones, visible plants) with each message so the model can give specific advice
- Streaming via SSE from the backend to the frontend
- No authentication required (hackathon scope) — consider rate limiting later
- Keep chat UI consistent with the existing dark frosted-glass aesthetic

## Implementation Plan

### Approach

Add a **Chat tab inside PlantPanel** — the panel gets "Plants" and "Chat" tabs at the top, switching between the plant list and a chat interface within the same frosted-glass container. The backend gets a new `/chat/stream` SSE endpoint that calls the Anthropic SDK (`AsyncAnthropic`, model `claude-sonnet-4-6`). The frontend reads the SSE stream with `ReadableStream` and renders plain text messages (no markdown rendering).

The system prompt is assembled per-request from static fire zone knowledge plus dynamic property context (address, active zones, visible plant names). Chat history lives in React state — no persistence beyond the session.

### Step 1: Backend — Add `anthropic` dependency

**File: `backend/pyproject.toml`** (edit)

Add `anthropic>=0.52.0,<1.0.0` to `[project.dependencies]`.

### Step 2: Backend — Create chat router

**File: `backend/app/routers/chat.py`** (new)

```python
router = APIRouter()

SYSTEM_PROMPT = """You are a fire-resilient landscaping advisor for Ashland, Oregon. ...
Zone 1 (0–5 ft): Immediate zone — non-combustible materials only...
Zone 2 (5–10 ft): Near structure — fire-resistant plants, low density...
Zone 3 (10–30 ft): Intermediate — well-spaced, low-growing species...
Zone 4 (30–100 ft): Extended defense — thinned trees, managed fuel loads...
"""
```

**Endpoint:** `POST /chat/stream`

**Request body (Pydantic model):**
```python
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    context: ChatContext | None = None

class ChatContext(BaseModel):
    address: str | None = None
    zones: list[str] = []
    plants: list[str] = []  # common names of visible plants
```

**Implementation:**
- Initialize `AsyncAnthropic()` (reads `ANTHROPIC_API_KEY` from env automatically)
- Build system prompt: static zone knowledge + dynamic context block (address, zones, plant names)
- Convert `history` + new `message` into the messages array
- Use `async with client.messages.stream(model="claude-sonnet-4-6", ...)`
- Return `StreamingResponse` yielding `data: {text}\n\n` SSE chunks, ending with `data: [DONE]\n\n`
- Wrap in try/except for `anthropic.APIError` → return 503 with error detail

**Lifecycle:**
- Create client in module scope
- Add `close()` to lifespan cleanup in `main.py`

### Step 3: Backend — Register router and handle errors

**File: `backend/app/main.py`** (edit)

- Import and include `chat.router`
- Add exception handler for `anthropic.APIError` → 503 response
- Close the Anthropic client in the lifespan shutdown

### Step 4: Backend — Tests

**File: `backend/tests/test_chat.py`** (new)

- Mock `anthropic.AsyncAnthropic` with `unittest.mock.patch`
- Test: successful stream returns SSE chunks ending with `[DONE]`
- Test: missing `ANTHROPIC_API_KEY` returns 500
- Test: API error from Anthropic returns 503
- Test: context fields are included in the system prompt
- Test: history messages are forwarded correctly

### Step 5: Frontend — Add SSE streaming API client

**File: `frontend/src/lib/chatApi.ts`** (new)

```typescript
export interface ChatContext {
  address?: string
  zones: string[]
  plants: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function streamChat(
  message: string,
  history: ChatMessage[],
  context: ChatContext,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void>
```

- `POST /api/chat/stream` with JSON body
- Read response via `response.body.getReader()`
- Parse SSE `data:` lines, call `onChunk` for each text delta
- Stop on `[DONE]` sentinel
- Throw `ApiError` on non-200 responses

### Step 6: Frontend — ChatPanel component

**File: `frontend/src/components/ChatPanel.tsx`** (new)

**Props:**
```typescript
interface ChatPanelProps {
  address?: string
  zones: string[]
  plants: Plant[]
}
```

**State:**
- `messages: ChatMessage[]` — conversation history
- `input: string` — current input value
- `isStreaming: boolean` — disables send button, shows typing indicator
- `error: string | null` — error display

**UI structure (plain text, no markdown rendering):**
1. **Message area** — scrollable div, auto-scrolls to bottom
   - User messages: right-aligned, subtle background
   - Assistant messages: left-aligned, default text color, rendered as plain text (white-space: pre-wrap)
2. **Input row** — text input + send button (or Enter to send)
   - Disabled while streaming
   - Placeholder: "Ask about fire-resilient landscaping..."

**Behavior:**
- On send: append user message to `messages`, call `streamChat`, incrementally build assistant message from chunks, append final assistant message
- Use `AbortController` so unmounting cancels in-flight streams
- Auto-scroll message area on each chunk via `scrollIntoView`
- Pass `address`, `zones`, and `plants.map(p => p.commonName)` as context

### Step 7: Frontend — Add tabs to PlantPanel

**File: `frontend/src/components/PlantPanel.tsx`** (edit)

- Add `activeTab: 'plants' | 'chat'` state (default `'plants'`)
- Add a **tab row** below the header with "Plants" and "Chat" tab buttons
  - Active tab: `border-bottom: 2px solid var(--color-fire)`, white text
  - Inactive tab: transparent bottom border, muted text
- When `'plants'` tab is active: render existing plant list content
- When `'chat'` tab is active: render `<ChatPanel>` passing `address`, `zones`, `plants`
- PlantPanel already receives the needed props; just thread them through
- No changes to the page layout / `index.tsx` — tabs live entirely inside PlantPanel

### Step 8: Frontend — ChatPanel tests

**File: `frontend/src/components/ChatPanel.test.tsx`** (new)

- Renders input field and send button
- Send button is disabled when input is empty
- Sending a message displays it in the message area
- Streamed response text appears incrementally (mock `fetch` with `ReadableStream`)
- Error state displays error message with retry option

### Step 9: Frontend — chatApi tests

**File: `frontend/src/lib/chatApi.test.ts`** (new)

- Calls onChunk for each SSE data line
- Stops on `[DONE]` sentinel
- Throws ApiError on non-200 response
- Supports AbortSignal cancellation

### Step 10: Validate

- Run `./scripts/validate.sh` (backend tests, frontend tests, types, lint)
- Manual test: start both dev servers, select an address, open chat tab, ask a question, verify streaming

---

### System Prompt Design

The system prompt is assembled from two parts:

**Static (always included):**
- Role: fire-resilient landscaping advisor for Ashland, OR
- Zone model definitions (Zone 1–4 with distances, purposes, plant guidance)
- CAL FIRE / IBHS defensible space principles
- Instruction to give practical, specific advice; recommend plants from the app's plant list when possible
- Instruction to keep responses concise (hackathon audience, not academic papers)

**Dynamic (per-request, from `context`):**
- "The user is viewing property at: {address}"
- "Active fire zones: {zones}"
- "Plants currently shown for these zones: {plant names}"
- If no address is selected: "The user has not yet selected a property address."

### Test Plan Summary

| Layer | What | How |
|-------|------|-----|
| Backend unit | Chat stream endpoint | pytest + mocked Anthropic client — SSE format, error handling, context in prompt |
| Frontend unit | `streamChat` API client | Vitest — SSE parsing, abort, error handling |
| Frontend unit | `ChatPanel` component | Vitest + Testing Library — send, display, stream, close |
| Integration | End-to-end chat flow | Manual — both dev servers, real Claude API call |

## Learnings

- **Anthropic SDK `messages.stream()` is lazy** — it returns a context manager; the actual HTTP request fires in `__aenter__`, not when `.stream()` is called. Wrapping `.stream()` in try/except doesn't catch auth/connection errors. Handle all errors inside the `async with` block instead.
- **uvicorn's `.env` loading timing is unreliable** — module-level code that reads env vars (like `AsyncAnthropic()` auto-reading `ANTHROPIC_API_KEY`) may run before uvicorn loads `.env`. Fix: explicitly `load_dotenv()` and pass `api_key=` to the constructor.
- **SSE errors after headers are sent can't become HTTP status codes** — once `StreamingResponse` starts, FastAPI exception handlers can't change the status code. Use sentinel SSE events (`data: [ERROR] ...`) and handle them on the frontend by throwing an `ApiError`.
- **`TypeError` from the Anthropic SDK** — missing API key raises `TypeError` (not `anthropic.APIError`), so catch both in the generator.
- **Tab-within-panel is simpler than a separate panel** — adding `activeTab` state to PlantPanel avoids changes to the page layout, route file, and overlay positioning. The chat component just needs to fill available space with `flex: 1`.
