import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlantEntryRow } from './PlantEntryRow'
import type { PlantEntry } from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    fetchPlants: vi.fn(),
  }
})

import { fetchPlants } from '../lib/api'
const mockFetchPlants = fetchPlants as ReturnType<typeof vi.fn>

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const PLANTS = {
  data: [
    {
      id: 'lwf-1',
      genus: 'Lavandula',
      species: 'angustifolia',
      commonName: 'English lavender',
      primaryImage: null,
      values: [
        {
          attributeId: 'b908b170-70c9-454d-a2ed-d86f98cb3de1',
          attributeName: 'HIZ',
          rawValue: '03',
          resolved: { value: '10-30', type: 'text', id: 'v1' },
        },
      ],
    },
  ],
  meta: { pagination: { total: 1, limit: 50, offset: 0, hasMore: false } },
}

function makeEntry(overrides: Partial<PlantEntry> = {}): PlantEntry {
  return {
    id: 'entry-1',
    taxlot_id: 'T1',
    zone: '10-30',
    plant_id: 'lwf-1',
    plant_name: 'English lavender',
    source: 'manual',
    image_url: null,
    notes: null,
    created_at: '2026-04-20T00:00:00Z',
    updated_at: '2026-04-20T00:00:00Z',
    ...overrides,
  }
}

describe('PlantEntryRow', () => {
  beforeEach(() => {
    mockFetchPlants.mockReset()
    mockFetchPlants.mockResolvedValue(PLANTS)
  })

  it('shows plant name and scientific name with lang="la"', async () => {
    const { container } = renderWithQuery(
      <PlantEntryRow
        entry={makeEntry()}
        onMove={() => {}}
        onDelete={() => {}}
        onAskRascal={() => {}}
      />,
    )
    expect(screen.getByText('English lavender')).toBeTruthy()
    await waitFor(() => {
      const sci = container.querySelector('[lang="la"]')
      expect(sci?.textContent).toContain('Lavandula')
    })
  })

  it('shows "Compatible" badge when plant is rated for current zone', async () => {
    renderWithQuery(
      <PlantEntryRow
        entry={makeEntry({ zone: '10-30' })}
        onMove={() => {}}
        onDelete={() => {}}
        onAskRascal={() => {}}
      />,
    )
    await waitFor(() => expect(mockFetchPlants).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Compatible')).toBeTruthy())
  })

  it('shows "Use caution" and mismatch warning when plant is in wrong zone', async () => {
    renderWithQuery(
      <PlantEntryRow
        entry={makeEntry({ zone: '0-5' })}
        onMove={() => {}}
        onDelete={() => {}}
        onAskRascal={() => {}}
      />,
    )
    await waitFor(() => expect(mockFetchPlants).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Use caution')).toBeTruthy())
    expect(screen.getByText(/Not rated for Zone 0-5/)).toBeTruthy()
  })

  it('shows "Not rated" for free-text entries', () => {
    renderWithQuery(
      <PlantEntryRow
        entry={makeEntry({ plant_id: null, plant_name: 'Gravel path' })}
        onMove={() => {}}
        onDelete={() => {}}
        onAskRascal={() => {}}
      />,
    )
    expect(screen.getByText('Not rated')).toBeTruthy()
  })

  it('Ask Rascal button invokes onAskRascal', () => {
    const onAskRascal = vi.fn()
    renderWithQuery(
      <PlantEntryRow
        entry={makeEntry({ plant_id: null, plant_name: 'Mint' })}
        onMove={() => {}}
        onDelete={() => {}}
        onAskRascal={onAskRascal}
      />,
    )
    fireEvent.click(screen.getByLabelText('Ask Rascal about Mint'))
    expect(onAskRascal).toHaveBeenCalledOnce()
  })

  it('clicking a move chip calls onMove with the target zone', () => {
    const onMove = vi.fn()
    renderWithQuery(
      <PlantEntryRow
        entry={makeEntry({ zone: '10-30', plant_id: null, plant_name: 'Mint' })}
        onMove={onMove}
        onDelete={() => {}}
        onAskRascal={() => {}}
      />,
    )
    fireEvent.click(screen.getByLabelText('Move to Zone 5-10'))
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'entry-1' }), '5-10')
  })

  it('current-zone chip is disabled', () => {
    renderWithQuery(
      <PlantEntryRow
        entry={makeEntry({ zone: '10-30', plant_id: null })}
        onMove={() => {}}
        onDelete={() => {}}
        onAskRascal={() => {}}
      />,
    )
    const current = screen.getByLabelText('Move to Zone 10-30') as HTMLButtonElement
    expect(current.disabled).toBe(true)
  })

  it('delete button invokes onDelete', () => {
    const onDelete = vi.fn()
    renderWithQuery(
      <PlantEntryRow
        entry={makeEntry({ plant_id: null, plant_name: 'Mint' })}
        onMove={() => {}}
        onDelete={onDelete}
        onAskRascal={() => {}}
      />,
    )
    fireEvent.click(screen.getByLabelText('Delete Mint'))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
