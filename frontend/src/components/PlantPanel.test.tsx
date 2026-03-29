import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlantPanel } from './PlantPanel'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    fetchPlants: vi.fn(),
  }
})

vi.mock('../lib/plantSearch', () => ({
  plantMatchesSearch: (plant: { commonName: string; genus: string; species: string }, query: string) => {
    const q = query.toLowerCase()
    return (
      plant.commonName.toLowerCase().includes(q) ||
      plant.genus.toLowerCase().includes(q) ||
      plant.species.toLowerCase().includes(q)
    )
  },
}))

import { fetchPlants } from '../lib/api'
const mockFetchPlants = fetchPlants as ReturnType<typeof vi.fn>

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

const SAMPLE_PLANTS = {
  data: [
    {
      id: 'plant-1',
      genus: 'Abelia',
      species: 'x grandiflora',
      commonName: 'Glossy abelia',
      primaryImage: {
        id: 'img-1',
        url: 'https://example.com/abelia.jpg',
        caption: null,
      },
      values: [
        {
          attributeId: 'b908b170-70c9-454d-a2ed-d86f98cb3de1',
          attributeName: 'Home Ignition Zone (HIZ)',
          rawValue: '03',
          resolved: { value: '10-30', type: 'text', id: 'val-1' },
        },
        {
          attributeId: 'b908b170-70c9-454d-a2ed-d86f98cb3de1',
          attributeName: 'Home Ignition Zone (HIZ)',
          rawValue: '04',
          resolved: { value: '30-100', type: 'text', id: 'val-2' },
        },
      ],
    },
    {
      id: 'plant-2',
      genus: 'Acer',
      species: 'palmatum',
      commonName: 'Japanese maple',
      primaryImage: null,
      values: [
        {
          attributeId: 'b908b170-70c9-454d-a2ed-d86f98cb3de1',
          attributeName: 'Home Ignition Zone (HIZ)',
          rawValue: '01',
          resolved: { value: '0-5', type: 'text', id: 'val-3' },
        },
      ],
    },
  ],
  meta: { pagination: { total: 2, limit: 50, offset: 0, hasMore: false } },
}

describe('PlantPanel', () => {
  beforeEach(() => {
    mockFetchPlants.mockReset()
  })

  it('renders plant list when data loads', async () => {
    mockFetchPlants.mockResolvedValue(SAMPLE_PLANTS)
    renderWithQuery(
      <PlantPanel zones={['10-30', '30-100', '0-5']} onClose={() => {}} />,
    )
    expect(await screen.findByText('Glossy abelia')).toBeTruthy()
    expect(screen.getByText('Japanese maple')).toBeTruthy()
  })

  it('filters plants by active zones', async () => {
    mockFetchPlants.mockResolvedValue(SAMPLE_PLANTS)
    renderWithQuery(<PlantPanel zones={['0-5']} onClose={() => {}} />)
    expect(await screen.findByText('Japanese maple')).toBeTruthy()
    // Glossy abelia has zones 10-30 and 30-100, not 0-5
    expect(screen.queryByText('Glossy abelia')).toBeNull()
  })

  it('shows empty state when no plants match', async () => {
    mockFetchPlants.mockResolvedValue({
      data: [],
      meta: { pagination: { total: 0, limit: 50, offset: 0, hasMore: false } },
    })
    renderWithQuery(<PlantPanel zones={['0-5']} onClose={() => {}} />)
    expect(await screen.findByText(/no plants/i)).toBeTruthy()
  })

  it('calls onClose when close button clicked', async () => {
    mockFetchPlants.mockResolvedValue(SAMPLE_PLANTS)
    const onClose = vi.fn()
    renderWithQuery(<PlantPanel zones={['10-30']} onClose={onClose} />)
    await screen.findByText('Glossy abelia')
    fireEvent.click(screen.getByLabelText('Close plant panel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('filters plants by search input', async () => {
    mockFetchPlants.mockResolvedValue(SAMPLE_PLANTS)
    renderWithQuery(<PlantPanel zones={['10-30', '30-100', '0-5']} onClose={() => {}} />)
    // Wait for data to load
    expect(await screen.findByText('Glossy abelia')).toBeTruthy()
    expect(screen.getByText('Japanese maple')).toBeTruthy()

    // Type in search box
    const searchInput = screen.getByPlaceholderText('Search plants...')
    fireEvent.change(searchInput, { target: { value: 'abelia' } })

    // Only matching plant should remain
    expect(screen.getByText('Glossy abelia')).toBeTruthy()
    expect(screen.queryByText('Japanese maple')).toBeNull()
  })

  it('shows "Y of X" count when searching', async () => {
    mockFetchPlants.mockResolvedValue(SAMPLE_PLANTS)
    renderWithQuery(<PlantPanel zones={['10-30', '30-100', '0-5']} onClose={() => {}} />)
    await screen.findByText('Glossy abelia')

    const searchInput = screen.getByPlaceholderText('Search plants...')
    fireEvent.change(searchInput, { target: { value: 'abelia' } })

    // Should show "1 of 2" (1 match out of 2 zone-filtered plants)
    expect(screen.getByText('1 of 2')).toBeTruthy()
  })

  it('shows all plants when search is cleared', async () => {
    mockFetchPlants.mockResolvedValue(SAMPLE_PLANTS)
    renderWithQuery(<PlantPanel zones={['10-30', '30-100', '0-5']} onClose={() => {}} />)
    await screen.findByText('Glossy abelia')

    const searchInput = screen.getByPlaceholderText('Search plants...')
    fireEvent.change(searchInput, { target: { value: 'abelia' } })
    expect(screen.queryByText('Japanese maple')).toBeNull()

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } })
    expect(screen.getByText('Glossy abelia')).toBeTruthy()
    expect(screen.getByText('Japanese maple')).toBeTruthy()
  })

  it('shows no-match message when search has no results', async () => {
    mockFetchPlants.mockResolvedValue(SAMPLE_PLANTS)
    renderWithQuery(<PlantPanel zones={['10-30', '30-100', '0-5']} onClose={() => {}} />)
    await screen.findByText('Glossy abelia')

    const searchInput = screen.getByPlaceholderText('Search plants...')
    fireEvent.change(searchInput, { target: { value: 'zzzznotaplant' } })

    expect(screen.queryByText('Glossy abelia')).toBeNull()
    expect(screen.getByText(/no plants match/i)).toBeTruthy()
  })
})
