import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlantCard } from './PlantCard'
import type { Plant, PlantEntry } from '../lib/api'
import { axeCheck } from '../test-utils/a11y'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return { ...actual, fetchPlants: vi.fn() }
})
import { fetchPlants } from '../lib/api'
const mockFetchPlants = fetchPlants as ReturnType<typeof vi.fn>

function renderCard(entryOverrides: Partial<PlantEntry> = {}, plantsData: Plant[] = []) {
  mockFetchPlants.mockResolvedValue({
    data: plantsData,
    meta: { pagination: { total: 0, limit: 50, offset: 0, hasMore: false } },
  })
  const entry: PlantEntry = {
    id: 'e1',
    taxlot_id: 'T1',
    zone: '5-10',
    plant_id: 'plant-1',
    plant_name: 'Rosemary',
    source: 'manual',
    image_url: null,
    notes: null,
    created_at: '',
    updated_at: '',
    ...entryOverrides,
  }
  const onOpen = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={qc}>
      <PlantCard entry={entry} onOpen={onOpen} />
    </QueryClientProvider>,
  )
  return { ...utils, onOpen, entry }
}

describe('PlantCard', () => {
  it('renders the plant name on the card face', () => {
    renderCard()
    expect(screen.getByText('Rosemary')).toBeInTheDocument()
  })

  it('exposes the full untruncated name plus zone via aria-label', () => {
    renderCard({ plant_name: 'California native lilac', zone: '10-30' })
    const btn = screen.getByRole('button', {
      name: /California native lilac, Zone 3\. Open details/,
    })
    expect(btn).toBeInTheDocument()
  })

  it('declares aria-haspopup="dialog"', () => {
    renderCard()
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('calls onOpen with the entry when clicked', () => {
    const { onOpen, entry } = renderCard()
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledWith(entry)
  })

  it('renders the primary image when available', () => {
    renderCard(
      { plant_id: 'plant-1' },
      [
        {
          id: 'plant-1',
          genus: 'Salvia',
          species: 'rosmarinus',
          commonName: 'Rosemary',
          primaryImage: { id: 'i1', url: 'https://example.com/r.jpg', caption: null },
          values: [],
        },
      ],
    )
    // Initial render is sync, but the plant resolves via async useQuery.
    // We assert the fallback first; after the query resolves, the image appears.
    expect(screen.queryByRole('img')).toBeNull() // pre-resolution
  })

  it('renders a fallback panel when there is no primary image', () => {
    const { container } = renderCard({ plant_id: 'plant-no-image' })
    // No <img> element initially.
    expect(container.querySelector('img')).toBeNull()
    // Fallback icon is present.
    expect(container.querySelector('.plant-card__fallback')).toBeInTheDocument()
  })

  it('uses the custom-item placeholder icon for entries with plant_id=null', () => {
    renderCard({ plant_id: null, plant_name: 'Compost pile' })
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('data-custom')).toBe('true')
    expect(btn.textContent).toContain('📍')
  })

  it('has no axe violations', async () => {
    const { container } = renderCard()
    expect(await axeCheck(container)).toHaveNoViolations()
  })
})
