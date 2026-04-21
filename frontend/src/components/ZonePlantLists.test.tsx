import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ZonePlantLists } from './ZonePlantLists'
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
    zone: '10-30',
    plant_id: null,
    plant_name: 'Mint',
    source: 'manual',
    image_url: null,
    notes: null,
    created_at: '2026-04-20T00:00:00Z',
    updated_at: '2026-04-20T00:00:00Z',
    ...overrides,
  }
}

describe('ZonePlantLists', () => {
  beforeEach(() => {
    mockFetchEntries.mockReset()
    mockCreateEntry.mockReset()
    mockUpdateEntry.mockReset()
    mockDeleteEntry.mockReset()
    mockFetchPlants.mockReset()
    mockFetchPlants.mockResolvedValue({
      data: [],
      meta: { pagination: { total: 0, limit: 50, offset: 0, hasMore: false } },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('shows disabled state when parcel has no buildings', () => {
    renderWithQuery(
      <ZonePlantLists taxlotId="T1" hasBuildings={false} onClose={() => {}} />,
    )
    expect(screen.getByText(/No buildings detected/)).toBeTruthy()
    expect(screen.getByText(/Why am I seeing this\?/)).toBeTruthy()
  })

  it('expands explainer on click', () => {
    renderWithQuery(
      <ZonePlantLists taxlotId="T1" hasBuildings={false} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByText(/Why am I seeing this\?/))
    expect(screen.getByText(/Fire zones are drawn as buffers/)).toBeTruthy()
  })

  it('renders four zone sections with counts', async () => {
    mockFetchEntries.mockResolvedValue({
      entries: [
        entry({ id: 'a', zone: '0-5', plant_name: 'Lawn' }),
        entry({ id: 'b', zone: '10-30', plant_name: 'Mint' }),
        entry({ id: 'c', zone: '10-30', plant_name: 'Rosemary' }),
      ],
    })
    renderWithQuery(
      <ZonePlantLists taxlotId="T1" hasBuildings onClose={() => {}} />,
    )
    await waitFor(() => expect(mockFetchEntries).toHaveBeenCalledWith('T1'))

    expect(await screen.findByText('Zone 1')).toBeTruthy()
    expect(screen.getByText('Zone 2')).toBeTruthy()
    expect(screen.getByText('Zone 3')).toBeTruthy()
    expect(screen.getByText('Zone 4')).toBeTruthy()

    // Zone 3 (10-30) count should be 2
    const zone3Count = screen.getByLabelText('2 plants')
    expect(zone3Count).toBeTruthy()
  })

  it('shows "Add the first plant" prompt in empty zones', async () => {
    mockFetchEntries.mockResolvedValue({ entries: [] })
    renderWithQuery(
      <ZonePlantLists taxlotId="T1" hasBuildings onClose={() => {}} />,
    )
    await waitFor(() => expect(mockFetchEntries).toHaveBeenCalled())
    expect(await screen.findByText('Add the first plant in Zone 1')).toBeTruthy()
    expect(screen.getByText('Add the first plant in Zone 4')).toBeTruthy()
  })

  it('groups entries into the correct section by zone', async () => {
    mockFetchEntries.mockResolvedValue({
      entries: [
        entry({ id: 'a', zone: '0-5', plant_name: 'Aloe' }),
        entry({ id: 'b', zone: '30-100', plant_name: 'Oak' }),
      ],
    })
    renderWithQuery(
      <ZonePlantLists taxlotId="T1" hasBuildings onClose={() => {}} />,
    )
    await screen.findByText('Aloe')
    expect(screen.getByText('Oak')).toBeTruthy()
  })

  it('clicking "+ Add plant" opens the combobox inline (not a modal)', async () => {
    mockFetchEntries.mockResolvedValue({ entries: [] })
    renderWithQuery(
      <ZonePlantLists taxlotId="T1" hasBuildings onClose={() => {}} />,
    )
    await waitFor(() => expect(mockFetchEntries).toHaveBeenCalled())
    const addButtons = await screen.findAllByText('+ Add plant')
    fireEvent.click(addButtons[0])
    // Combobox appears
    expect(screen.getByRole('combobox')).toBeTruthy()
    // Only one combobox at a time (no other zone's control expanded)
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })

  it('announces add via aria-live', async () => {
    mockFetchEntries.mockResolvedValue({ entries: [] })
    mockCreateEntry.mockImplementation((data) =>
      Promise.resolve(entry({ ...data, id: 'new' })),
    )
    renderWithQuery(
      <ZonePlantLists taxlotId="T1" hasBuildings onClose={() => {}} />,
    )
    await waitFor(() => expect(mockFetchEntries).toHaveBeenCalled())
    const addButtons = await screen.findAllByText('+ Add plant')
    fireEvent.click(addButtons[0])
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'Gravel' } })
    await screen.findByText((_c, el) =>
      !!el && el.tagName === 'LI' && el.textContent === 'Add “Gravel” as custom entry',
    )
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      const status = screen.getByText(/Gravel added to Zone 1/)
      expect(status).toBeTruthy()
    })
    expect(mockCreateEntry.mock.calls[0][0]).toEqual({
      taxlot_id: 'T1',
      zone: '0-5',
      plant_id: null,
      plant_name: 'Gravel',
    })
  })

  it('delete does not hit the backend if Undo is clicked within 5s', async () => {
    mockFetchEntries.mockResolvedValue({
      entries: [entry({ id: 'del-1', zone: '10-30', plant_name: 'Mint' })],
    })
    mockDeleteEntry.mockResolvedValue(undefined)
    renderWithQuery(
      <ZonePlantLists taxlotId="T1" hasBuildings onClose={() => {}} />,
    )
    await screen.findByText('Mint')

    // Switch to fake timers only for the undo window
    vi.useFakeTimers()
    fireEvent.click(screen.getByLabelText('Delete Mint'))
    expect(screen.queryByText('Mint')).toBeNull()
    const undoBtn = screen.getByText('Undo')
    const toast = undoBtn.closest('[role="status"]')
    expect(toast?.getAttribute('aria-keyshortcuts')).toBe('Alt+Z')
    fireEvent.click(undoBtn)
    expect(screen.getByText('Mint')).toBeTruthy()
    // Advance past the original 5s window — timer should be cancelled
    act(() => {
      vi.advanceTimersByTime(6000)
    })
    vi.useRealTimers()
    expect(mockDeleteEntry).not.toHaveBeenCalled()
  })

  it('delete fires backend call after the 5s window', async () => {
    mockFetchEntries.mockResolvedValue({
      entries: [entry({ id: 'del-2', zone: '10-30', plant_name: 'Mint' })],
    })
    mockDeleteEntry.mockResolvedValue(undefined)
    renderWithQuery(
      <ZonePlantLists taxlotId="T1" hasBuildings onClose={() => {}} />,
    )
    await screen.findByText('Mint')
    vi.useFakeTimers()
    fireEvent.click(screen.getByLabelText('Delete Mint'))
    expect(screen.queryByText('Mint')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(5100)
    })
    vi.useRealTimers()
    await waitFor(() => expect(mockDeleteEntry).toHaveBeenCalledWith('del-2'))
  })

  it('move chip calls updateEntry and announces', async () => {
    mockFetchEntries.mockResolvedValue({
      entries: [entry({ id: 'm1', zone: '10-30', plant_name: 'Mint' })],
    })
    mockUpdateEntry.mockImplementation((id, data) =>
      Promise.resolve(entry({ id, ...data, plant_name: 'Mint' })),
    )
    renderWithQuery(
      <ZonePlantLists taxlotId="T1" hasBuildings onClose={() => {}} />,
    )
    await screen.findByText('Mint')
    fireEvent.click(screen.getByLabelText('Move to Zone 30-100'))
    await waitFor(() => expect(mockUpdateEntry).toHaveBeenCalled())
    expect(mockUpdateEntry.mock.calls[0].slice(0, 2)).toEqual([
      'm1',
      { zone: '30-100' },
    ])
  })
})

