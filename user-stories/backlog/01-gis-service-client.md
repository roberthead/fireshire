# Story: GIS Service Client

## Summary

AS a developer
I WANT a shared async HTTP client for Ashland GIS requests with timeouts and retries
SO THAT all backend GIS calls are reliable and errors surface clearly

## Acceptance Criteria

- `GISClient` wraps `httpx.AsyncClient` with base URL `https://gis.ashland.or.us`, 5s connect timeout, 15s read timeout
- Retries up to 2x on 5xx/connection errors with exponential backoff (1s, 2s); no retry on 4xx
- Raises `GISServiceError` (with upstream status and message) that FastAPI translates to a 503 JSON response `{"error": "gis_unavailable", "detail": "..."}`
- Instantiated once via FastAPI lifespan context, connection pool reused, properly closed on shutdown
- pytest tests with mocked HTTP cover: success, retry-then-success, exhausted retries, timeout, 4xx pass-through

## Notes

- Size: S
- Priority: P1
- Dependencies: None
- Every backend endpoint depends on this client — build it first

## Implementation Plan

[to be filled in by Claude, including test plan]

## Learnings

[to be filled in by Claude after implementation]
