import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MapProvider } from '../contexts/MapContext'
import { AddressSearch } from './AddressSearch'

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
  it('renders the search input and button', () => {
    renderWithProviders(<AddressSearch />)
    expect(screen.getByPlaceholderText('e.g. 455 Siskiyou Blvd')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  it('disables button when input is too short', () => {
    renderWithProviders(<AddressSearch />)
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
  })
})
