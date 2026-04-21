import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddPlantCombobox } from './AddPlantCombobox'

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

const SAMPLE_PLANTS = {
  data: [
    {
      id: 'p1',
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
    {
      id: 'p2',
      genus: 'Rosmarinus',
      species: 'officinalis',
      commonName: 'Rosemary',
      primaryImage: null,
      values: [
        {
          attributeId: 'b908b170-70c9-454d-a2ed-d86f98cb3de1',
          attributeName: 'HIZ',
          rawValue: '02',
          resolved: { value: '5-10', type: 'text', id: 'v2' },
        },
      ],
    },
  ],
  meta: { pagination: { total: 2, limit: 50, offset: 0, hasMore: false } },
}

describe('AddPlantCombobox', () => {
  beforeEach(() => {
    mockFetchPlants.mockReset()
    mockFetchPlants.mockResolvedValue(SAMPLE_PLANTS)
  })

  it('renders a combobox input with aria attributes', () => {
    renderWithQuery(
      <AddPlantCombobox zone="5-10" onCommit={() => {}} onCancel={() => {}} />,
    )
    const input = screen.getByRole('combobox')
    expect(input.getAttribute('aria-autocomplete')).toBe('list')
  })

  it('filters LWF results as user types', async () => {
    renderWithQuery(
      <AddPlantCombobox zone="5-10" onCommit={() => {}} onCancel={() => {}} />,
    )
    await waitFor(() => expect(mockFetchPlants).toHaveBeenCalled())
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'rose' } })
    await screen.findByText('Rosemary')
    expect(screen.queryByText('English lavender')).toBeNull()
  })

  it('shows "Add custom entry" as last option when text is typed', async () => {
    renderWithQuery(
      <AddPlantCombobox zone="5-10" onCommit={() => {}} onCancel={() => {}} />,
    )
    await waitFor(() => expect(mockFetchPlants).toHaveBeenCalled())
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'zzznotaplant' } })
    expect(
      await screen.findByText((_content, el) =>
        !!el && el.tagName === 'LI' && el.textContent === 'Add “zzznotaplant” as custom entry',
      ),
    ).toBeTruthy()
  })

  it('Enter commits the active LWF option', async () => {
    const onCommit = vi.fn()
    renderWithQuery(
      <AddPlantCombobox zone="5-10" onCommit={onCommit} onCancel={() => {}} />,
    )
    await waitFor(() => expect(mockFetchPlants).toHaveBeenCalled())
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'rose' } })
    await screen.findByText('Rosemary')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Rosemary', plant: expect.objectContaining({ id: 'p2' }) }),
    )
  })

  it('ArrowDown moves aria-activedescendant', async () => {
    renderWithQuery(
      <AddPlantCombobox zone="10-30" onCommit={() => {}} onCancel={() => {}} />,
    )
    await waitFor(() => expect(mockFetchPlants).toHaveBeenCalled())
    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'a' } })
    await screen.findByText('English lavender')
    const first = input.getAttribute('aria-activedescendant')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const second = input.getAttribute('aria-activedescendant')
    expect(second).not.toBe(first)
  })

  it('Escape invokes onCancel', async () => {
    const onCancel = vi.fn()
    renderWithQuery(
      <AddPlantCombobox zone="0-5" onCommit={() => {}} onCancel={onCancel} />,
    )
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('committing custom text produces plant=null', async () => {
    const onCommit = vi.fn()
    renderWithQuery(
      <AddPlantCombobox zone="0-5" onCommit={onCommit} onCancel={() => {}} />,
    )
    await waitFor(() => expect(mockFetchPlants).toHaveBeenCalled())
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'gravel path' } })
    // Options: 0 matches (nothing matches "gravel path") + custom (index 0)
    await screen.findByText((_c, el) =>
      !!el && el.tagName === 'LI' && el.textContent === 'Add “gravel path” as custom entry',
    )
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledWith({ plant: null, label: 'gravel path' })
  })
})
