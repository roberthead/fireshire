# Plant cards

GIVEN I'm on the map page

WHEN I add a plant in a zone
I WANT to see the plants in each zone presented as a miniature card, akin to a trading card (5:7 aspect ratio), with the common name of the plant (truncated if necessary)
IN ORDER TO get a quick visual understanding of my environment

AND WHEN I click on a plant card
I WANT to see the plant details in a lightbox / modal
IN ORDER to get more details about the fire characteristics of that plant

WHEN I add an arbitrary item in a zone (like a compost pile)
I WANT to see the same kind of card with the text entered

AND WHEN I click on the item card
I WANT to see a lightbox where I can enter a more detailed description

## Resolved Decisions

1. **Replace, don't coexist.** The card grid replaces today's `PlantEntryRow` list view inside each zone section. No toggle.
2. **Card content.** Common name (truncated as needed) + the plant's `primaryImage` thumbnail. No suitability badge / scientific name on the card itself — those live in the lightbox.
3. **Lightbox content for known plants.** Render *all* of the plant's `values[]` attributes from the LWF API as a key/value list. Curate later once we see what's noisy.
4. **Custom-item descriptions persist.** Save into the existing `plant_entries.notes` field on the backend. Lightbox provides an editable text area; commit on blur or explicit Save.
5. **All actions live in the lightbox.** Move (zone chips), Chat (chat), and Delete are pulled off the card surface and rendered inside the lightbox. The card itself is a clean trading-card face with image + title only. Move chips on tiny cards would dominate the visual.
6. **Custom (no `plant_id`) vs known (`plant_id` set) cards.** Same 5:7 aspect ratio. Custom cards show a placeholder image (icon) instead of `primaryImage`, and the lightbox shows the editable description field instead of the `values[]` list.

## Implementation Plan

### Overview

Replace the per-zone `<PlantEntryRow>` list with a responsive **5:7 trading-card grid** built from two new components (`PlantCard`, `PlantCardGrid`), and lift all per-entry actions (move chips, Chat, Delete, edit description) into a single **`PlantLightbox`** dialog with two body variants — `PlantLightboxKnown` (renders LWF `values[]` as a `<dl>`) and `PlantLightboxCustom` (editable `notes` textarea persisted via existing `updateEntry`). No backend changes expected; `notes` and PATCH already work (verify in Increment 5 checkpoint).

### Increment 1 — Component skeleton + state ownership (no UI yet)

- Decide: `ZonePlantLists` owns `openEntryId: string | null` (single shared lightbox across zones — avoids 4 separately-stateful zone islands).
- Create files (empty exports + types only): `frontend/src/components/PlantCard.tsx`, `PlantCardGrid.tsx`, `PlantLightbox.tsx`, `PlantLightboxKnown.tsx`, `PlantLightboxCustom.tsx`.
- Wire `ZonePlantLists` to render `<PlantCardGrid>` instead of `<ul>` of rows, passing `entries`, `onOpen(entry)`, and `openEntryId`. Keep `PlantEntryRow` import temporarily for the test transition; remove in Increment 6.
- Tests: type-check only.
- Risk: minimal.

### Increment 2 — `PlantCard` + `PlantCardGrid` visuals (parallel-safe with Inc 3)

- 5:7 aspect via `aspect-ratio: 5 / 7`. Card is a `<button type="button">` with `aria-haspopup="dialog"` + `aria-label` carrying the full untruncated name (e.g., `"English lavender, Zone 5-10. Open details"`) — screen readers get the full text, sighted users see truncation.
- Title truncation: **two-line clamp** (`-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden`). One-line ellipsis loses too much info for plants like "California native lilac." Title bar sits on a translucent gradient at the bottom of the card so it reads over imagery.
- Image: `<img>` with `loading="lazy"`, `decoding="async"`, `alt=""` (decorative — title carries meaning), `object-fit: cover`. Fallback when `primaryImage` is `null` **or** the entry is custom (`plant_id === null`): a colored panel using `--color-shire` (custom) / `--color-leaf` (known-no-image) with a centered icon (🌱 for known, 📍 for custom).
- Grid: CSS Grid `grid-template-columns: repeat(auto-fill, minmax(96px, 1fr))`, `gap: 0.5rem`. With the ~340px panel that yields 3 columns; gracefully drops to 2 then 1 as the panel narrows. No JS observers.
- Hover: subtle `transform: translateY(-1px)` + border highlight; focus ring uses an inset 2px outline visible against any background.
- Tests (`PlantCard.test.tsx`): (a) renders title; (b) full name in `aria-label`; (c) renders `<img>` when `primaryImage` set; (d) renders fallback panel when null; (e) custom entry uses placeholder icon; (f) `onClick` fires with entry.
- Risk: jsdom `loading="lazy"` — assert the attribute is set; don't depend on actual lazy behavior.

### Increment 3 — `PlantLightbox` shell + a11y (parallel-safe with Inc 2)

- Use the **platform `<dialog>` element** with `dialog.showModal()` inside a `useEffect`, and `dialog.close()` on dismiss. Rationale: native focus trap, native ESC, native backdrop, native `inert` semantics, no custom-roll bugs. Caveats: (a) call `showModal()` in the effect (not the `open` attribute) so the trap activates; (b) attach a `close` event handler so ESC and backdrop click route through one `onClose`.
- `aria-labelledby={titleId}` on the dialog; `useId()` for `titleId` and `descriptionId`.
- Backdrop click: detect via `e.target === dialogRef.current` (clicks bubble from the `<dialog>` when the backdrop is hit).
- Return focus: cache `document.activeElement` (the card) at mount; on close, call `.focus()` on it inside a `requestAnimationFrame` (cards re-render on entry mutations).
- Header: title + close button (× 44×44, `aria-label="Close"`).
- Footer / action rail (shared across variants): 4 zone-move chips (lifted from `PlantEntryRow`, same `aria-label="Move to Zone X-Y"`), Chat, Delete.
- Behavior decisions:
  - **Move while open**: do NOT close the lightbox. Update in place; chips re-render with new disabled state; announce via existing polite announcer.
  - **Delete from lightbox**: close first, then call existing `handleDelete(entry)` so the undo toast flow is identical. Return focus to the closest still-rendered card in the same zone (or zone's "+ Add plant" button if none remain) via a small `focusAfterRemoval(zone)` helper.
  - **Chat**: close lightbox, call `handleChat(entry)`, focus moves to chat input via existing effect.
- Tests (`PlantLightbox.test.tsx`): opens/closes on `entry` prop, `aria-labelledby` set, ESC closes, backdrop click closes, inner click doesn't, focus returns to trigger on close, move keeps it open, delete closes it.
- Risk: verify jsdom `<dialog>` + `showModal()` support in our vitest version. If unsupported, fall back to a `role="dialog"` div with a manual focus trap (sentinel focus loops) — keep the component API stable so the swap is local.

### Increment 4 — `PlantLightboxKnown` (values list)

- Resolve the plant by `entry.plant_id` from the cached `fetchPlants` query (same pattern as `PlantEntryRow`). Loading state: small "Loading details…" line.
- Render `values[]` as `<dl>`:
  - `<dt>{attributeName}</dt><dd>{resolved.value}</dd>` per CLAUDE.md (use `resolved.value`, not `rawValue`).
  - Skip entries with null/empty `resolved.value`.
  - Two-column grid layout (`grid-template-columns: 1fr 2fr`) so long labels wrap cleanly.
- Show `genus species` (italicized, `lang="la"`) and the suitability badge here (lifted off the card face).
- Tests: renders all `values[]` as `<dt>/<dd>`, uses `resolved.value`, skips empty values, renders scientific name with `lang="la"`, suitability badge present.
- **DEFERRED**: curating which `values[]` show (HIZ, fire group, drought tolerance, etc.) — this story renders all.

### Increment 5 — `PlantLightboxCustom` (editable description)

- **Checkpoint first**: verify `backend/app/routers/plant_entries.py` accepts `PATCH { "notes": "…" }` without other fields. If `PlantEntryUpdate` enforces "at least one of zone/plant_name", relax it. Backend test in `test_plant_entry_router.py`.
- Controlled `<textarea>` bound to local state seeded from `entry.notes ?? ''`. Visible "Description" label.
- **Save model**: explicit Save button with dirty-state tracking. Rationale: blur-to-save creates surprises when users click an action button (blur fires before click); also avoids network traffic on every focus change. Save disabled when `description === (entry.notes ?? '')`. Optimistic update via existing `updateMutation`. Cancel button reverts local state.
- Announce `"<label> details saved"` on save.
- Tests: textarea seeded from `entry.notes`, Save disabled when unchanged, Save calls `updateEntry(id, { notes })`, Cancel reverts, optimistic UI preserved, `aria-describedby` ties textarea to a help line.

### Increment 6 — Test rewrite + cleanup

- **`PlantEntryRow.test.tsx`** → rename to `PlantLightbox.integration.test.tsx`. Retarget assertions:
  - "plant name and scientific name" → covered in `PlantLightboxKnown.test.tsx`.
  - "Compatible / Use caution / mismatch warning" → moved into `PlantLightboxKnown.test.tsx`.
  - "Chat invokes onChat" → action rail.
  - "clicking a move chip calls onMove" → action rail inside dialog.
  - "current-zone chip disabled" → same, inside dialog.
  - "delete invokes onDelete" → same, inside dialog.
- **`ZonePlantLists.test.tsx`** — every test that did `getByLabelText('Move to Zone X')` / `getByLabelText('Delete <name>')` directly on a row gets an opening step: `fireEvent.click(screen.getByRole('button', { name: /<name>/ }))` to open the lightbox first. Add a new test: opening one card then a second replaces the first lightbox content (single shared dialog).
- **`ZonePlantLists.keyboard.test.tsx`** — re-route Step 3:
  - After commit, tab to the new card and press Enter → dialog opens → assert focus lands on the first non-disabled move chip (so Enter-Enter activates).
  - Find `Move to Zone 10-30` chip *inside* the dialog; Enter moves.
  - For delete: focus the Delete button in the dialog; Enter closes + removes + shows Undo toast.
  - Add an ESC-closes-dialog assertion before the delete step.
- New `PlantCardGrid.axe.test.tsx` + `PlantLightbox.axe.test.tsx`: empty grid + populated grid + each lightbox variant must pass `axeCheck`.
- Delete `PlantEntryRow.tsx` and its import in `ZonePlantLists.tsx`. `./scripts/validate.sh` passes.

### Design & UX Considerations

- 5:7 portrait card with image filling the frame and a darkened gradient strip at the bottom holding the truncated title in white. Reads as a trading card, holds up over satellite tiles.
- Cards: subtle 80ms fade-in gated by `prefers-reduced-motion: no-preference`. Lightbox uses native `<dialog>` open animation (also gated).
- Lightbox layout: title row → suitability + scientific name → image (full-width, capped at 60vh) → values (`<dl>`) or description textarea → action rail anchored at the bottom (sticky inside the dialog for long values lists).
- 44px touch targets preserved for every action; cards at least 96px wide via grid `minmax`.

### Accessibility Requirements

- Card = `<button>` (no URL), `aria-haspopup="dialog"`, `aria-label` carries full common name + zone (sighted truncation is decorative).
- Image `alt=""` because title and `aria-label` carry meaning (avoids double-announcement).
- Dialog uses native `<dialog>` + `showModal()` for built-in focus trap. `aria-labelledby` points to title `useId()`. ESC + backdrop click both close.
- Initial focus inside dialog: first non-disabled move chip (or Save button if the textarea has unsaved work). Return focus to triggering card on close, or fallback to the zone's "+ Add plant" if the card was removed.
- Polite-announce summaries on the existing `aria-live`: `"Details opened for <name>"`, `"<name> moved to <Zone>"`, `"<name> removed. Undo available."`, `"<name> details saved"`.
- Both empty and populated grid states gated by `vitest-axe` WCAG 2.1 AA tests.
- Custom card placeholder icon: `aria-hidden="true"`.

### Testing Strategy

- Unit: `PlantCard`, `PlantCardGrid`, `PlantLightbox` shell, `PlantLightboxKnown`, `PlantLightboxCustom` — each with focused render + interaction tests.
- Integration: rewritten `ZonePlantLists.test.tsx` opens the lightbox before asserting per-entry actions.
- Keyboard E2E: `ZonePlantLists.keyboard.test.tsx` re-routes through card → dialog → action rail → close → toast.
- A11y gates: two new `*.axe.test.tsx` files for grid + dialog states.
- `./scripts/validate.sh` must pass.

### Risks & Open Questions

- **PATCH with `notes`-only**: verified at start of Increment 5; relax `PlantEntryUpdate` if needed.
- **jsdom `<dialog>` support**: verify in Increment 3; fall back to manual focus trap if `showModal()` isn't implemented.
- **Move-while-open** could confuse some users. If real testing shows that, switch to "close on move and re-focus the moved card in its new zone" — one-line change in `onMove`.

### Deferred / Out of Scope

- Curating which `values[]` show in `PlantLightboxKnown` (e.g., promoting HIZ to the top, hiding internal IDs).
- Image lazy-loading optimization beyond `loading="lazy"` (responsive `srcset`, blur-up placeholders).
- Drag-to-reorder or drag-between-zones.
- Persisting card-grid sort order (alphabetic vs added-order). Renders in insertion order today.
- Lightbox swipe-between-cards on touch devices.

## Learnings

- **The pre-flight checkpoints earned their keep.** Two five-minute checks (jsdom `<dialog>.showModal()` support; backend PATCH validator on `{notes}`-only payloads) determined the structural path before any component code. jsdom does NOT implement `showModal()` — the planner's preferred native-dialog path would have wasted an afternoon. Verifying first cost nothing and made the fallback (manual focus trap) the obvious move from minute one.
- **A manual focus trap is ~30 lines.** A `role="dialog"` div + `useEffect` listening for `keydown` (Tab/Shift-Tab + ESC) + a focusable-element selector is enough. No third-party modal library needed. The same code works in browsers and jsdom identically — no platform divergence to debug.
- **`aria-label` as the meaningful name, with decorative visual truncation, is the right pattern.** The card's title is `-webkit-line-clamp: 2`, but the button's `aria-label="<full name>, <zone>. Open details"` carries the complete text. Sighted users get the truncation; screen-reader users get the full string. Easy to forget; axe gates it implicitly via "button must have accessible name."
- **`role="definition"` does not have an accessible name** in Testing Library. `getByRole('definition', { name: 'X' })` silently fails. When a string appears in both a `<dd>` and a button's `aria-label`, scope via `document.querySelectorAll('dd')` and `Array.from(...).map(el => el.textContent)` to disambiguate.
- **Single shared lightbox via `openEntryId` at the parent is the right shape.** One state field at `ZonePlantLists`, one `onOpen` callback threaded through `<PlantCardGrid>`. Per-zone state would have meant four parallel modals racing for focus. The shared model also closes naturally when the open entry disappears (e.g., after a successful undo timeout) because the `openEntry` memo returns null when the id is no longer in `entries`.
- **Move-while-open stays open by design.** When the user moves a plant from Zone 2 to Zone 3 via the dialog, the dialog doesn't close — chips just re-render with the new disabled state. This lets the user keep exploring (compare suitability, read more values) without losing context. The plan flagged it as a judgment call; if real testing pushes back, it's a one-line change in `onMove`.
- **Most existing tests didn't need retargeting.** Only 3 ZonePlantLists tests + 1 keyboard E2E needed updates after the row → card + dialog refactor. The data layer (mutations, optimistic cache updates, undo timer, announcer text) is untouched; cards/lightbox are a pure presentation layer over that. Good architecture pays you back at refactor time.
- **`exclude_unset=True` on the FastAPI PATCH made the backend free.** Because the existing endpoint already calls `body.model_dump(exclude_unset=True)`, a `{notes: "..."}` payload sends only `notes` to the CRUD layer. No schema change, no validator tweak, no new tests. The pre-flight checkpoint's value here was *confirming* this rather than discovering it mid-implementation.
- **`<dialog>` element vs. custom `role="dialog"`: choose by environment, not aesthetics.** Native `<dialog>` is the cleaner API and the right choice when your test environment supports it. jsdom hasn't shipped `showModal()` as of this writing, so any test-driven project should default to the manual-trap path or stub the dialog API. Worth re-checking annually — when jsdom adds support, swap in one place.
- **The trading-card aesthetic actually works.** A 5:7 card with image filling the frame and a darkened-gradient title strip at the bottom reads instantly as a "card" without explanation. The 96px `minmax` keeps cards usable across panel widths, and the green/purple fallback gradients (known/custom) give the panel personality at zero asset cost.
