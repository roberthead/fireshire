# Story: Satellite Basemap

## Summary

AS a homeowner
I WANT to see a satellite view of Ashland when the app loads
SO THAT I can visually orient myself before searching for my property

## Acceptance Criteria

- `MapView` React component initializes Mapbox GL JS with style `satellite-streets-v12`, centered on Ashland (~42.19, -122.71), zoom 15
- Mapbox token read from `VITE_MAPBOX_TOKEN` env var (not hardcoded); friendly error if missing/invalid
- Map instance shared via React context (`MapContext`) so sibling components can add sources/layers without prop drilling
- Standard map controls available: zoom in/out, rotation, pitch
- Proper cleanup on unmount (`map.remove()`), Mapbox GL CSS imported
- Vitest tests: renders without crash (mocked mapbox-gl), error state on missing token

## Notes

- Size: M
- Priority: P1
- Dependencies: None (parallel with backend Stories 1-3)
- Replaces the current grey placeholder in the index route

## Implementation Plan

[to be filled in by Claude, including test plan]

## Learnings

[to be filled in by Claude after implementation]
