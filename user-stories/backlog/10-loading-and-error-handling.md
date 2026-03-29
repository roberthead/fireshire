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

[to be filled in by Claude, including test plan]

## Learnings

[to be filled in by Claude after implementation]
