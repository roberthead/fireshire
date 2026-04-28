import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MapProvider } from '../contexts/MapContext'
import { AddressSearch } from './AddressSearch'
import * as api from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    fetchParcels: vi.fn(),
  }
})

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MapProvider>{ui}</MapProvider>
    </QueryClientProvider>,
  )
}

describe('AddressSearch', () => {
  beforeEach(() => {
    vi.mocked(api.fetchParcels).mockReset()
  })

  it('renders the search input and button', () => {
    vi.mocked(api.fetchParcels).mockResolvedValue({ parcels: [], suggestions: [] })
    renderWithProviders(<AddressSearch />)
    expect(screen.getByPlaceholderText('e.g. 455 Siskiyou Blvd')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  it('disables button when input is too short', () => {
    vi.mocked(api.fetchParcels).mockResolvedValue({ parcels: [], suggestions: [] })
    renderWithProviders(<AddressSearch />)
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
  })

  it('renders did-you-mean list when suggestions present and parcels empty', async () => {
    vi.mocked(api.fetchParcels).mockResolvedValue({
      parcels: [],
      suggestions: [
        { address: '2770 DIANE ST', taxlot_id: 'X', score: 88 },
      ],
    })

    renderWithProviders(<AddressSearch />)

    const input = screen.getByPlaceholderText('e.g. 455 Siskiyou Blvd') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2770 Dianne St' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('Did you mean…?')).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: '2770 DIANE ST' }),
    ).toBeInTheDocument()
  })

  it('clicking a suggestion re-runs the search with that address', async () => {
    vi.mocked(api.fetchParcels).mockResolvedValue({
      parcels: [],
      suggestions: [
        { address: '2770 DIANE ST', taxlot_id: 'X', score: 88 },
      ],
    })

    renderWithProviders(<AddressSearch />)

    const input = screen.getByPlaceholderText('e.g. 455 Siskiyou Blvd') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2770 Dianne St' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    const suggestionButton = await screen.findByRole('button', { name: '2770 DIANE ST' })

    fireEvent.click(suggestionButton)

    await waitFor(() => {
      expect((screen.getByPlaceholderText('e.g. 455 Siskiyou Blvd') as HTMLInputElement).value).toBe('2770 DIANE ST')
    })

    await waitFor(() => {
      expect(vi.mocked(api.fetchParcels)).toHaveBeenCalledWith('2770 DIANE ST')
    })

    const calls = vi.mocked(api.fetchParcels).mock.calls
    expect(calls.length).toBeGreaterThanOrEqual(2)
  })

  it('does not show "no results" banner when suggestions are present', async () => {
    vi.mocked(api.fetchParcels).mockResolvedValue({
      parcels: [],
      suggestions: [
        { address: '2770 DIANE ST', taxlot_id: 'X', score: 88 },
      ],
    })

    renderWithProviders(<AddressSearch />)

    const input = screen.getByPlaceholderText('e.g. 455 Siskiyou Blvd') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2770 Dianne St' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('Did you mean…?')).toBeInTheDocument()
    expect(
      screen.queryByText(/We couldn't find that address/i),
    ).not.toBeInTheDocument()
  })

  it('shows "no results" banner when both parcels and suggestions are empty', async () => {
    vi.mocked(api.fetchParcels).mockResolvedValue({ parcels: [], suggestions: [] })

    renderWithProviders(<AddressSearch />)

    const input = screen.getByPlaceholderText('e.g. 455 Siskiyou Blvd') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'nonsense address' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(
      await screen.findByText(/We couldn't find that address/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Did you mean…?')).not.toBeInTheDocument()
  })
})
