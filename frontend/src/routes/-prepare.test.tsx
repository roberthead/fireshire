import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => ({ options: config }),
  useNavigate: () => navigate,
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    fetchParcels: vi.fn(),
  }
})

vi.mock('../lib/allclearApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/allclearApi')>('../lib/allclearApi')
  return {
    ...actual,
    resolveParcel: vi.fn(),
  }
})

import * as api from '../lib/api'
import * as allclear from '../lib/allclearApi'

function makeParcel(overrides: Partial<api.Parcel> = {}): api.Parcel {
  return {
    address: '570 SISKIYOU BLVD',
    taxlot_id: 'TX1',
    acreage: 0.25,
    owner: 'SMITH JOHN',
    centroid: { lat: 42.19, lng: -122.71 },
    geometry: { type: 'Polygon', coordinates: [[[0, 0]]] },
    ...overrides,
  }
}

function renderPrepare(Component: React.ComponentType) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Component />
    </QueryClientProvider>,
  )
}

describe('PreparePage', () => {
  beforeEach(() => {
    navigate.mockReset()
    vi.mocked(api.fetchParcels).mockReset()
    vi.mocked(allclear.resolveParcel).mockReset()
  })

  it('renders the resident search by default with prepare-specific copy', async () => {
    const mod = await import('./prepare')
    renderPrepare((mod as unknown as { Route: { options: { component: React.ComponentType } } }).Route.options.component)
    expect(screen.getByLabelText('Your Ashland property address')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Find My Property' })).toBeInTheDocument()
    expect(screen.getByText('We cover properties inside Ashland city limits.')).toBeInTheDocument()
  })

  it('has accessible toggle buttons with aria-pressed', async () => {
    const mod = await import('./prepare')
    renderPrepare((mod as unknown as { Route: { options: { component: React.ComponentType } } }).Route.options.component)

    const resident = screen.getByRole('button', { name: "I'm a Resident" })
    const hoa = screen.getByRole('button', { name: "I'm an HOA" })

    expect(resident.getAttribute('aria-pressed')).toBe('true')
    expect(hoa.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(hoa)
    expect(resident.getAttribute('aria-pressed')).toBe('false')
    expect(hoa.getAttribute('aria-pressed')).toBe('true')
  })

  it('toggle group has aria-label "Choose your role"', async () => {
    const mod = await import('./prepare')
    renderPrepare((mod as unknown as { Route: { options: { component: React.ComponentType } } }).Route.options.component)
    expect(screen.getByRole('group', { name: 'Choose your role' })).toBeInTheDocument()
  })

  it('selecting a result calls resolveParcel and navigates with returned hash_code', async () => {
    vi.mocked(api.fetchParcels).mockResolvedValue({
      parcels: [
        { id: 'TX1', address: '570 SISKIYOU BLVD', raw: makeParcel() },
        { id: 'TX2', address: '572 SISKIYOU BLVD', raw: makeParcel({ taxlot_id: 'TX2', address: '572 SISKIYOU BLVD' }) },
      ],
      suggestions: [],
    })
    vi.mocked(allclear.resolveParcel).mockResolvedValue({ hash_code: 'gabc1234567890ab', created: true })

    const mod = await import('./prepare')
    renderPrepare((mod as unknown as { Route: { options: { component: React.ComponentType } } }).Route.options.component)

    const input = screen.getByLabelText('Your Ashland property address') as HTMLInputElement
    fireEvent.change(input, { target: { value: '570 Siskiyou' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find My Property' }))

    const resultBtn = await screen.findByRole('button', { name: /570 SISKIYOU BLVD/ })
    fireEvent.click(resultBtn)

    await waitFor(() => {
      expect(allclear.resolveParcel).toHaveBeenCalledWith({
        map_taxlot: 'TX1',
        situs_address: '570 SISKIYOU BLVD',
        owner_name: 'SMITH JOHN',
        acreage: 0.25,
      })
    })
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: '/survey/$hashCode',
        params: { hashCode: 'gabc1234567890ab' },
      })
    })
  })

  it('does NOT auto-navigate on a single result (autoSelectSingle=false)', async () => {
    vi.mocked(api.fetchParcels).mockResolvedValue({
      parcels: [{ id: 'TX1', address: '570 SISKIYOU BLVD', raw: makeParcel() }],
      suggestions: [],
    })

    const mod = await import('./prepare')
    renderPrepare((mod as unknown as { Route: { options: { component: React.ComponentType } } }).Route.options.component)

    const input = screen.getByLabelText('Your Ashland property address') as HTMLInputElement
    fireEvent.change(input, { target: { value: '570 Siskiyou' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find My Property' }))

    // Result rendered as button; resolveParcel not called yet.
    await screen.findByRole('button', { name: /570 SISKIYOU BLVD/ })
    expect(allclear.resolveParcel).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('shows error message when resolveParcel fails', async () => {
    vi.mocked(api.fetchParcels).mockResolvedValue({
      parcels: [
        { id: 'TX1', address: '570 SISKIYOU BLVD', raw: makeParcel() },
        { id: 'TX2', address: '572 SISKIYOU BLVD', raw: makeParcel({ taxlot_id: 'TX2' }) },
      ],
      suggestions: [],
    })
    vi.mocked(allclear.resolveParcel).mockRejectedValue(new Error('database busy'))

    const mod = await import('./prepare')
    renderPrepare((mod as unknown as { Route: { options: { component: React.ComponentType } } }).Route.options.component)

    fireEvent.change(screen.getByLabelText('Your Ashland property address'), { target: { value: '570 Siskiyou' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find My Property' }))

    fireEvent.click(await screen.findByRole('button', { name: /570 SISKIYOU BLVD/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('database busy')
    expect(navigate).not.toHaveBeenCalled()
  })
})
