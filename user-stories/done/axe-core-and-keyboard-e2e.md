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

### Overview

Install `vitest-axe` and add WCAG 2.1 AA axe-core assertions to four critical component tests (ZonePlantLists, AddressSearch, ChatPanel, ZoneSummary) via a shared `axeCheck()` helper, then layer one jsdom-based keyboard-only E2E walkthrough on top of `ZonePlantLists` that drives the full populate-by-zone flow with `fireEvent.keyDown` and a small `pressTab()` focus walker. Any violations surfaced are fixed in-story at the component level.

### Resolved Open Questions

1. **vitest-axe over jest-axe.** Project is on Vitest; `vitest-axe` exposes the same `toHaveNoViolations` matcher, ships native ESM, and avoids the jest-globals shim. No reason to pull in jest-axe.
2. **jsdom (not Playwright) for the walkthrough.** The flow is purely keyboard + DOM state — no scroll-into-view, no focus rings, no IME. jsdom + `fireEvent.keyDown` matches the project's established pattern (CLAUDE.md learning: no `@testing-library/user-event`). Playwright would add a browser binary and a second test runner. Defer until a real-DOM concern actually surfaces.
3. **E2E lives at the ZonePlantLists level.** Mounting the whole `/` route would drag in TanStack Router, Mapbox, and address-search side effects unrelated to populate-by-zone. ZonePlantLists is the smallest mount that exercises AddPlantCombobox, PlantEntryRow chips, delete, and undo toast in one tree.
4. **`pressTab()` focus walker.** jsdom does not implement browser tab order. Standardize a tiny helper that queries focusable elements (`button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])`) in document order, finds `activeElement`, and focuses the next/previous match. Lives in `frontend/src/test-utils/keyboard.ts` alongside `pressKey()`.
5. **Axe violations get fixed in-story, not deferred.** ChatPanel and ZonePlantLists are the highest-risk surfaces (dynamic regions, custom chips, toast). If a violation requires a structural redesign, carve it out as a new story and ship the axe assertion with `runOnly` excluding the offending rule plus a `TODO` referencing the carve-out.

### Increment 1 — Install and wire vitest-axe

- `frontend/package.json` — add `vitest-axe` to `devDependencies`.
- `frontend/src/test/setup.ts` (or the existing Vitest setup file) — `expect.extend(matchers)` from `vitest-axe/matchers` plus the `toHaveNoViolations` type augmentation.
- `frontend/src/test-utils/a11y.ts` (new) — exports `axeCheck(container, options?)` that calls `axe(container, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })`. Centralizes the WCAG ruleset so every test asserts the same bar.
- `frontend/vitest.config.ts` — verify `setupFiles` includes the setup module (likely already true).

**Test plan**: throwaway `a11y.test.tsx` that asserts the matcher passes on `<button>hi</button>` and fails on `<img>` with no alt. Delete once the real component tests prove the wiring.

**Risks**: vitest-axe + jsdom is ~200–500ms per call. Mitigate by scoping `axeCheck` to the rendered container, not `document.body`, and running axe once per state, not per assertion.

### Increment 2 — Add axe assertions to the four critical component tests

Parallel sub-tasks; none touch each other. One new `it('has no axe violations')` block per file, using `axeCheck`:

- `frontend/src/components/ZonePlantLists.test.tsx` — empty state (no pinned plants) and populated state (mock returns plants for zones 1-4).
- `frontend/src/components/AddressSearch.test.tsx` — idle state and the open-results / open-suggestions state.
- `frontend/src/components/ChatPanel.test.tsx` — collapsed and expanded. If streaming output is async, render a finished-stream state via mocked SSE.
- `frontend/src/components/ZoneSummary.test.tsx` — populated zone breakdown.

**Likely violations to fix at component level** (not defer):

- `AddPlantCombobox` / `AddressSearch` listbox: missing `aria-activedescendant`, missing `role="option"` `aria-selected`, or input lacking `aria-controls`/`aria-expanded`.
- `ChatPanel`: streaming region likely needs `aria-live="polite"` + `aria-busy` toggling; send button may lack accessible name when icon-only.
- `PlantEntryRow` move chips: zone color chips may fail WCAG 1.4.3 contrast against the dark frosted-glass background.
- `ZoneSummary`: color-coded swatches need a non-color label (zone number / distance text already present — verify accessible name).

### Increment 3 — Keyboard test utilities

`frontend/src/test-utils/keyboard.ts` (new):

- `pressKey(key, opts?)` — wraps `fireEvent.keyDown(document.activeElement!, { key, ...opts })` then `keyUp`.
- `pressTab({ shift = false } = {})` — fires Tab on `activeElement`, walks focusable elements in document order, calls `.focus()` on the next/previous match. Required because jsdom does not move focus on Tab keydown.
- `typeInto(element, text)` — sets `value` and dispatches `input` + `change` for controlled inputs.

**Test plan**: small `keyboard.test.ts` mounts three buttons, asserts `pressTab()` cycles `activeElement` correctly forward and backward.

**Risks**: focus order in jsdom can disagree with browsers when mixed `tabindex` values are present. Document the helper's limitation (positive-and-zero tabindex elements treated as document-order) so future tests don't expect browser-correct ordering.

### Increment 4 — Keyboard E2E walkthrough for populate-by-zone

`frontend/src/components/ZonePlantLists.keyboard.test.tsx` (new) — colocated with the component to match the project's pattern; the filename suffix signals scope.

**Before writing**: read `StatusBanner.tsx` and the parent that wires the undo toast to confirm whether undo is dispatched via callback, context, or a toast queue, so the test mounts the right scope.

Walkthrough (each step verified by inspecting `document.activeElement` or DOM state, never with `userEvent.click`):

1. Mount `<ZonePlantLists />` with mocked plants query and a populated zone 2 row already present. Focus the document body.
2. `pressTab()` until `activeElement` is the Zone 2 "+ Add plant" button → `pressKey('Enter')`.
3. Combobox input focused → `typeInto(input, 'rosem')` → listbox opens → `pressKey('ArrowDown')` → assert `aria-activedescendant` on the rosemary option → `pressKey('Enter')` → new row appears in zone 2.
4. `pressTab()` to the new row's Zone 3 move chip → `pressKey('Enter')` → row moved.
5. `pressTab()` to the delete button → `pressKey('Enter')` → row removed AND undo toast rendered.
6. `pressTab()` (direction determined empirically based on toast DOM order) to the toast's "Undo" button → `pressKey('Enter')` → row restored in zone 3.

**Mocks**: reuse `useZonePlants` (or equivalent query hook), LWF Plants API client, and pinned-plants persistence layer mocks from `ZonePlantLists.test.tsx` / `AddPlantCombobox.test.tsx`.

**Risks**:

- **AddPlantCombobox arrow handling** — verify it listens on `keyDown` (not `keyPress`) before writing the test.
- **Undo toast focus management** — if the toast appears but isn't in tab order or doesn't auto-focus its Undo button, the walkthrough requires an explicit `.focus()` call. If so, that is itself an a11y bug — fix the toast (move it earlier in tab order or auto-focus on appearance), don't paper over in the test.
- **Multi-step fragility** — keep step assertions targeted (`getByRole`, `getByLabelText`); never snapshot the whole tree.

### Increment 5 — Wire into validate.sh and document

- `scripts/validate.sh` — no changes expected (Vitest picks up new test files automatically); verify locally.
- `CLAUDE.md` — append learnings (axe ruleset choice, `pressTab` rationale, any fixed violations worth remembering).

**Test plan**: full `./scripts/validate.sh`. Watch that total frontend test time hasn't regressed by more than ~3 seconds.

### Accessibility Requirements

- **WCAG target: 2.1 AA.** axe ruleset configured to `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. Defer 2.2 AA and `best-practice` rules — they're noisy for an MVP and surface false positives.
- **Criteria covered**: 1.3.1 (info/relationships), 1.4.3 (contrast), 2.1.1 (keyboard), 2.4.3 (focus order), 4.1.2 (name/role/value), 4.1.3 (status messages, via undo toast).
- **Caveats**: axe in jsdom cannot verify visible focus indicators (2.4.7) or actual composited contrast with `backdrop-filter` (1.4.3 is computed from declared colors, not pixels). Note this in the test file's leading comment so future maintainers know what is and is not covered.

### Testing Strategy

- **Unit-level axe** assertions per component, one call per meaningful state, scoped to the rendered container.
- **Single keyboard E2E** at ZonePlantLists — broad enough to catch cross-component focus regressions, narrow enough to mock without TanStack Router.
- **Helpers in `frontend/src/test-utils/`** — `a11y.ts` and `keyboard.ts` — shared, typed, and unit-tested themselves.
- **No snapshot tests**; assertions target roles, labels, and `activeElement` only.

### Risks

- **Real violations will surface** — plan for component-level fixes within this story, not as follow-ups (see Increment 2 list). Structural redesigns get carved out into new stories.
- **jsdom tab order** is an approximation. If the walkthrough is flaky because the focusable-elements query disagrees with intended order, the fallback is explicit `.focus()` calls per step — annotate clearly.
- **Axe runtime cost** ~200–500ms per call in jsdom. Eight assertions across four files should add <5s to the frontend suite; watch for regression.

### Deferred / Out of Scope

- **Playwright migration** — revisit only if a real-DOM-only concern blocks jsdom.
- **Standalone CI axe job** (Pa11y, Lighthouse CI) — separate future story.
- **WCAG 2.2 AA and `best-practice` rules** — follow-up audit once 2.1 AA is clean.

## Learnings

- **Zero axe violations across all four critical components.** The story's biggest finding: a11y work done incrementally in prior stories (sr-only announcers, `useId()` prefixes, `autocomplete="street-address"`, `aria-pressed` on toggles, `aria-keyshortcuts="Alt+Z"` on the toast, role/label coverage everywhere) was correct. Without an axe gate, that quality is invisible and easy to regress. The test suite now locks it in.
- **vitest-axe's bundled type augmentation is broken under Vitest 4.** It targets `Vi.Assertion`, a namespace that was removed. Hand-write a `.d.ts` augmenting `Matchers<T>` in `@vitest/expect` (the documented user-extension point) — Assertion extends Matchers, so the matcher methods propagate. A small bit of boilerplate, but the only correct path; the alternative (downgrading vitest or vitest-axe) is worse.
- **`.d.ts` files in `src/` are picked up via tsconfig's `include` glob; do NOT runtime-import them.** Adding `import './vitest-axe'` made tsc happy but caused Vite to fail with "Failed to resolve import" at test time. Type-only modules have no JS to load. This is obvious in retrospect but the IDE's auto-import insistence made it easy to get wrong.
- **jsdom doesn't bridge Enter-on-button to a click event.** Browsers do this natively as part of the platform contract; jsdom does not. A custom `pressKey()` that fires `keyDown` + (synthetic `click` if target is a button) + `keyUp` mirrors browser semantics. Without that, every keyboard test would need explicit `fireEvent.click` calls, defeating the "keyboard-only" framing.
- **Don't chase focus across React re-parenting.** When a plant row moves from Zone 2 to Zone 3, React unmounts the row in the old `<ul>` and remounts it in the new one. Focus is lost. Trying to walk Tab/Shift-Tab across that boundary is fragile and tests implementation details. Use direct `.focus()` + `pressKey('Enter')` and document why — it's still keyboard activation, not a mouse click.
- **`queueMicrotask`-based focus restoration is racy in tests.** The ZonePlantLists component restores focus to the add button after commit via `queueMicrotask(() => addButtonRefs.current[zone]?.focus())`. From the test's perspective, the timing depends on React internals and may or may not have completed before the next assertion. Assert "the chip is reachable and Enter dispatches the move action" instead of "focus is at the specific anchor."
- **WCAG ruleset choice matters for signal-to-noise.** `runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }` is the right MVP bar. axe's `best-practice` rules surface false positives in jsdom (e.g., flagging deeply nested landmark roles that are fine). 2.2 AA can be a follow-up audit once 2.1 is clean.
- **Axe in jsdom has real coverage gaps.** It cannot verify visible focus indicators (WCAG 2.4.7) — that needs a real browser. And contrast (1.4.3) is computed from declared color values, not composited pixels, so `backdrop-filter: blur` defeats accurate measurement. Annotate these limits in the test header so future maintainers don't read "axe green" as "fully a11y-clean."
- **`pressTab()` over a focusable-element selector is approximate.** It walks `button, input, [href], [tabindex]:not([tabindex="-1"])` in document order, which matches browser behavior for zero/no tabindex but disagrees when positive tabindex values are mixed. Good enough for this codebase (we don't use positive tabindex); document the limitation in the helper.
- **The keyboard E2E test scope was right at ZonePlantLists.** Mounting the full `/` route would have dragged in TanStack Router, Mapbox, and address-search side effects unrelated to the populate-by-zone flow. ZonePlantLists is the smallest mount that exercises AddPlantCombobox, PlantEntryRow, and the undo toast in one tree. Smaller scope = faster tests + less mocking + clearer regression signal when something breaks.
