import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddressSearch } from './AddressSearch'
import type { SearchEnvelope } from '../lib/api'
import { ApiError } from '../lib/api'
import { axeCheck } from '../test-utils/a11y'

type RawShape = { taxlot_id: string }

function envelope(parcels: { id: string; address: string }[] = [], suggestions: { id: string; address: string }[] = []): SearchEnvelope<RawShape> {
  return {
    parcels: parcels.map((p) => ({ ...p, raw: { taxlot_id: p.id } })),
    suggestions,
  }
}

function renderSearch(props: Partial<React.ComponentProps<typeof AddressSearch<RawShape>>> = {}) {
  const searchFn = props.searchFn ?? vi.fn(async () => envelope())
  const onSelect = props.onSelect ?? vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AddressSearch<RawShape>
        inputAriaLabel="Address"
        queryKey="parcels-test"
        searchFn={searchFn}
        onSelect={onSelect}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { ...utils, searchFn, onSelect }
}

function submit(address: string) {
  const input = screen.getByLabelText('Address') as HTMLInputElement
  fireEvent.change(input, { target: { value: address } })
  fireEvent.click(screen.getByRole('button', { name: /search/i }))
  return input
}

describe('AddressSearch', () => {
  it('renders form with input and submit button', () => {
    renderSearch()
    expect(screen.getByLabelText('Address')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  it('disables submit when input is too short', () => {
    renderSearch()
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
  })

  it('renders emptyHint before any search runs', () => {
    renderSearch({ emptyHint: 'Ashland only.' })
    expect(screen.getByText('Ashland only.')).toBeInTheDocument()
  })

  it('submits and calls searchFn with trimmed address', async () => {
    const { searchFn } = renderSearch()
    submit('  570 Siskiyou  ')
    await waitFor(() => {
      expect(searchFn).toHaveBeenCalledWith('570 Siskiyou')
    })
  })

  it('auto-selects single result when autoSelectSingle (default true)', async () => {
    const result = { id: 'T1', address: '570 SISKIYOU BLVD' }
    const searchFn = vi.fn(async () => envelope([result]))
    const onSelect = vi.fn()
    renderSearch({ searchFn, onSelect })
    submit('570 Siskiyou')
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect.mock.calls[0][0]).toMatchObject({ id: 'T1', address: '570 SISKIYOU BLVD' })
    })
  })

  it('does not auto-select when autoSelectSingle is false; renders single result as clickable', async () => {
    const result = { id: 'T1', address: '570 SISKIYOU BLVD' }
    const searchFn = vi.fn(async () => envelope([result]))
    const onSelect = vi.fn()
    renderSearch({ searchFn, onSelect, autoSelectSingle: false })
    submit('570 Siskiyou')

    const button = await screen.findByRole('button', { name: '570 SISKIYOU BLVD' })
    expect(onSelect).not.toHaveBeenCalled()

    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('renders disambiguation list for 2+ results and calls onSelect on click', async () => {
    const searchFn = vi.fn(async () =>
      envelope([
        { id: 'T1', address: '570 SISKIYOU BLVD' },
        { id: 'T2', address: '572 SISKIYOU BLVD' },
      ]),
    )
    const onSelect = vi.fn()
    renderSearch({ searchFn, onSelect })
    submit('Siskiyou')

    fireEvent.click(await screen.findByRole('button', { name: '572 SISKIYOU BLVD' }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'T2' }))
  })

  it('renders "Did you mean…?" when only suggestions are present', async () => {
    const searchFn = vi.fn(async () =>
      envelope([], [{ id: 'X', address: '2770 DIANE ST' }]),
    )
    renderSearch({ searchFn })
    submit('2770 Dianne St')

    expect(await screen.findByText('Did you mean…?')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '2770 DIANE ST' })).toBeInTheDocument()
  })

  it('clicking a suggestion re-runs the search by default', async () => {
    const searchFn = vi.fn(async () =>
      envelope([], [{ id: 'X', address: '2770 DIANE ST' }]),
    )
    renderSearch({ searchFn })
    submit('2770 Dianne St')

    const suggestion = await screen.findByRole('button', { name: '2770 DIANE ST' })
    fireEvent.click(suggestion)

    await waitFor(() => {
      expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('2770 DIANE ST')
    })
    await waitFor(() => {
      expect(searchFn).toHaveBeenCalledWith('2770 DIANE ST')
    })
  })

  it('suggestion click only populates input when autoResubmitSuggestions=false', async () => {
    const searchFn = vi.fn(async () =>
      envelope([], [{ id: 'X', address: '2770 DIANE ST' }]),
    )
    renderSearch({ searchFn, autoResubmitSuggestions: false })
    submit('2770 Dianne St')

    fireEvent.click(await screen.findByRole('button', { name: '2770 DIANE ST' }))
    await waitFor(() => {
      expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('2770 DIANE ST')
    })
    // Only the initial search ran; the suggestion click did not trigger another.
    const resubmitCalls = (searchFn.mock.calls as unknown as [string][]).filter(
      ([addr]) => addr === '2770 DIANE ST',
    )
    expect(resubmitCalls).toHaveLength(0)
  })

  it('renders not-found warning when both lists are empty', async () => {
    const searchFn = vi.fn(async () => envelope())
    renderSearch({ searchFn })
    submit('nonsense address')
    expect(await screen.findByText(/We couldn't find that address/i)).toBeInTheDocument()
    expect(screen.queryByText('Did you mean…?')).not.toBeInTheDocument()
  })

  it('renders error banner with retry on API errors', async () => {
    const searchFn = vi.fn(async () => {
      throw new ApiError(503, 'gis_unavailable', 'GIS down')
    })
    renderSearch({ searchFn })
    submit('570 Siskiyou')
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('sets aria-invalid on input when there is an error', async () => {
    const searchFn = vi.fn(async () => {
      throw new ApiError(0, 'network_error', "Can't reach server.")
    })
    renderSearch({ searchFn })
    submit('570 Siskiyou')
    await waitFor(() => {
      expect((screen.getByLabelText('Address') as HTMLInputElement).getAttribute('aria-invalid')).toBe('true')
    })
  })

  it('input has autocomplete="street-address"', () => {
    renderSearch()
    expect((screen.getByLabelText('Address') as HTMLInputElement).getAttribute('autocomplete')).toBe('street-address')
  })

  it('has no axe violations in idle state', async () => {
    const { container } = renderSearch()
    expect(await axeCheck(container)).toHaveNoViolations()
  })

  it('has no axe violations with disambiguation results visible', async () => {
    const searchFn = vi.fn(async () =>
      envelope([
        { id: 'T1', address: '570 SISKIYOU BLVD' },
        { id: 'T2', address: '572 SISKIYOU BLVD' },
      ]),
    )
    const { container } = renderSearch({ searchFn })
    submit('Siskiyou')
    await screen.findByRole('button', { name: '570 SISKIYOU BLVD' })
    expect(await axeCheck(container)).toHaveNoViolations()
  })

  it('has no axe violations with "Did you mean…?" suggestions visible', async () => {
    const searchFn = vi.fn(async () =>
      envelope([], [{ id: 'X', address: '2770 DIANE ST' }]),
    )
    const { container } = renderSearch({ searchFn })
    submit('2770 Dianne St')
    await screen.findByText('Did you mean…?')
    expect(await axeCheck(container)).toHaveNoViolations()
  })
})
