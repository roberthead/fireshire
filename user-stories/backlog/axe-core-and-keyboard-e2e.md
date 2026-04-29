# Story: Automated Accessibility Testing — axe-core + Keyboard E2E

## Summary

AS a developer maintaining FireShire
ON the critical user-facing views
I WANT automated axe-core assertions and a full keyboard walkthrough test
SO THAT accessibility regressions are caught in CI rather than discovered by users

## Acceptance Criteria

- `jest-axe` (or equivalent axe-core integration for Vitest) is installed and configured
- A test helper renders a component and asserts `expect(results).toHaveNoViolations()` — usable from any component test
- axe-core assertions exist for at least these critical views:
  - Zones view (ZonePlantLists in both empty and populated states)
  - Address search (AddressSearch)
  - Chat panel (ChatPanel)
  - Zone summary (ZoneSummary)
- A single end-to-end keyboard walkthrough test exists for the populate-by-zone flow:
  - Tab to "+ Add plant" in Zone 2 → Enter
  - Type "rosem" → ArrowDown → Enter to commit
  - Tab to the new row's move chip for Zone 3 → Enter
  - Tab to delete → Enter
  - Tab/Shift-Tab to "Undo" in toast → Enter
  - Each step verified without `mouseClick` / `userEvent.click`
- All new tests pass in `./scripts/validate.sh`

## Notes

- Carved out from the populate-by-zone story (acceptance criterion: "the zones view must be axe-core clean")
- Component-level keyboard tests already exist for the units; this story adds the cross-component flow that the populate-by-zone test plan called for but was not implemented
- The keyboard walkthrough may use `fireEvent.keyDown` (project does not install `@testing-library/user-event` — see CLAUDE.md learning) or jsdom limitations may push this to Playwright; pick the lighter option that works

## Implementation Plan

[to be filled in by Claude, including test plan]

## Learnings

[to be filled in by Claude after implementation]
