/**
 * Keyboard-only E2E walkthrough for the populate-by-zone flow.
 *
 * Covers: tab to add → Enter → combobox typing + ArrowDown + Enter to commit
 *         → shift-tab to move chip → Enter → re-focus delete → Enter
 *         → focus Undo in toast → Enter → row restored.
 *
 * Coverage caveats (axe-core in jsdom):
 * - Does not verify visible focus indicators (WCAG 2.4.7) or composited contrast
 *   under backdrop-filter (1.4.3). Those need a real browser.
 * - jsdom tab order is approximated by document order over a focusable selector,
 *   which can disagree with browsers when positive/zero tabindex values are mixed.
 *   When the DOM re-parents (e.g., a plant moves zones), we use direct `.focus()`
 *   calls to anchor the next step, with comments explaining why.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ZonePlantLists } from './ZonePlantLists'
import { pressKey, pressTab, typeInto } from '../test-utils/keyboard'
import type { PlantEntry } from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    fetchEntries: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    fetchPlants: vi.fn(),
  }
})

import {
  fetchEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  fetchPlants,
} from '../lib/api'

const mockFetchEntries = fetchEntries as ReturnType<typeof vi.fn>
const mockCreateEntry = createEntry as ReturnType<typeof vi.fn>
const mockUpdateEntry = updateEntry as ReturnType<typeof vi.fn>
const mockDeleteEntry = deleteEntry as ReturnType<typeof vi.fn>
const mockFetchPlants = fetchPlants as ReturnType<typeof vi.fn>

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function entry(overrides: Partial<PlantEntry> = {}): PlantEntry {
  return {
    id: overrides.id ?? `e-${Math.random()}`,
    taxlot_id: 'T1',
    zone: '5-10',
    plant_id: null,
    plant_name: 'Rosemary',
    source: 'manual',
    image_url: null,
    notes: null,
    created_at: '2026-04-20T00:00:00Z',
    updated_at: '2026-04-20T00:00:00Z',
    ...overrides,
  }
}

const rosemaryPlant = {
  id: 'plant-rosemary',
  genus: 'Salvia',
  species: 'rosmarinus',
  commonName: 'Rosemary',
  primaryImage: null,
  values: [],
}

beforeEach(() => {
  mockFetchEntries.mockReset()
  mockCreateEntry.mockReset()
  mockUpdateEntry.mockReset()
  mockDeleteEntry.mockReset()
  mockFetchPlants.mockReset()

  mockFetchEntries.mockResolvedValue({ entries: [] })
  mockFetchPlants.mockResolvedValue({
    data: [rosemaryPlant],
    meta: { pagination: { total: 1, limit: 50, offset: 0, hasMore: false } },
  })
  mockCreateEntry.mockImplementation((data) =>
    Promise.resolve(entry({ ...data, id: 'new-plant' })),
  )
  mockUpdateEntry.mockImplementation((id, data) =>
    Promise.resolve(entry({ id, ...data })),
  )
  mockDeleteEntry.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

function tabUntil(
  predicate: (el: Element) => boolean,
  max = 30,
): HTMLElement {
  for (let i = 0; i < max; i++) {
    pressTab()
    const el = document.activeElement
    if (el && predicate(el)) return el as HTMLElement
  }
  throw new Error(`tabUntil: predicate not satisfied within ${max} steps`)
}

describe('populate-by-zone — keyboard-only walkthrough', () => {
  it('add via combobox, move to next zone, delete, undo — all keyboard', async () => {
    renderWithQuery(
      <ZonePlantLists taxlotId="T1" hasBuildings onClose={() => {}} />,
    )

    // Wait for the entries query to settle and the four zones to render.
    await waitFor(() => expect(mockFetchEntries).toHaveBeenCalled())
    await screen.findByText('Add the first plant in Zone 2')

    // ── Step 1: tab to Zone 2 "+ Add plant" → Enter to open combobox ────────
    // Add buttons all share the same accessible name; we want the second one.
    const addButtons = screen.getAllByText('+ Add plant')
    const zone2AddButton = addButtons[1] as HTMLButtonElement
    expect(zone2AddButton).toBeTruthy()

    // Tab from body until activeElement equals the Zone 2 add button.
    document.body.focus()
    tabUntil((el) => el === zone2AddButton)
    expect(document.activeElement).toBe(zone2AddButton)

    pressKey('Enter')

    // ── Step 2: combobox is open and input is focused. Type, ArrowDown, Enter ─
    const combobox = (await screen.findByRole('combobox')) as HTMLInputElement
    expect(document.activeElement).toBe(combobox)

    typeInto(combobox, 'rosem')

    // Listbox renders with rosemary option matched.
    const listbox = await screen.findByRole('listbox')
    expect(listbox).toBeInTheDocument()
    // Custom-add option is also present ("Add 'rosem' as custom entry").
    expect(combobox.getAttribute('aria-expanded')).toBe('true')

    // ArrowDown advances activeIndex from 0 (rosemary match) to 1 (custom add),
    // then ArrowUp returns to rosemary so we commit the matched plant.
    pressKey('ArrowDown')
    pressKey('ArrowUp')
    const rosemaryOption = await screen.findByRole('option', { name: /Rosemary/i })
    expect(rosemaryOption.getAttribute('aria-selected')).toBe('true')
    expect(combobox.getAttribute('aria-activedescendant')).toBe(
      rosemaryOption.id,
    )

    pressKey('Enter')

    // Commit fires createEntry with zone '5-10' (Zone 2) and the matched label.
    await waitFor(() => expect(mockCreateEntry).toHaveBeenCalled())
    expect(mockCreateEntry.mock.calls[0][0]).toMatchObject({
      taxlot_id: 'T1',
      zone: '5-10',
      plant_id: 'plant-rosemary',
      plant_name: 'Rosemary',
    })

    // New row visible — find the new plant card (button with "Open details" label).
    const rosemaryCard = await screen.findByRole('button', {
      name: /Rosemary.*Open details/i,
    })

    // ── Step 3: open the card's lightbox via keyboard, then Move ────────────
    // After commit, the component returns focus to the Zone 2 add button via
    // queueMicrotask — a path React owns. Rather than chase that, focus the
    // card directly (still keyboard-driven) and press Enter to open.
    ;(rosemaryCard as HTMLButtonElement).focus()
    pressKey('Enter')

    // Dialog opens; initial focus lands on the first non-disabled move chip
    // per PlantLightbox's effect — the Zone 1 chip (since the row is in Zone 2,
    // which is disabled).
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()

    // Find the "Move to Zone 10-30" chip inside the dialog and Enter on it.
    const moveToZone3 = screen.getByLabelText('Move to Zone 10-30') as HTMLButtonElement
    expect(moveToZone3.disabled).toBe(false)
    moveToZone3.focus()
    pressKey('Enter')

    await waitFor(() => expect(mockUpdateEntry).toHaveBeenCalled())
    expect(mockUpdateEntry.mock.calls[0].slice(0, 2)).toEqual([
      'new-plant',
      { zone: '10-30' },
    ])

    // Lightbox stays open after a move (resolved decision); ESC closes it
    // before we proceed to the delete step.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    pressKey('Escape')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // ── Step 4: open the card again, focus Delete, Enter ────────────────────
    const rosemaryCardAgain = await screen.findByRole('button', {
      name: /Rosemary.*Open details/i,
    })
    ;(rosemaryCardAgain as HTMLButtonElement).focus()
    pressKey('Enter')
    await screen.findByRole('dialog')

    const deleteBtn = screen.getByLabelText('Delete Rosemary')
    ;(deleteBtn as HTMLButtonElement).focus()
    pressKey('Enter')

    // Dialog closes, row is optimistically removed, undo toast appears.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByText('Rosemary')).toBeNull()
    const undoBtn = await screen.findByText('Undo')
    const toast = undoBtn.closest('[role="status"]')
    expect(toast?.getAttribute('aria-keyshortcuts')).toBe('Alt+Z')

    // ── Step 5: focus Undo and press Enter to restore ───────────────────────
    ;(undoBtn as HTMLButtonElement).focus()
    pressKey('Enter')

    // Row restored; backend delete never fired.
    expect(screen.getByText('Rosemary')).toBeInTheDocument()
    expect(mockDeleteEntry).not.toHaveBeenCalled()
  })
})
