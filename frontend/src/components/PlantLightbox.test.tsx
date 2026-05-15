import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlantLightbox } from './PlantLightbox'
import type { PlantEntry } from '../lib/api'
import { axeCheck } from '../test-utils/a11y'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return { ...actual, fetchPlants: vi.fn() }
})
import { fetchPlants } from '../lib/api'
const mockFetchPlants = fetchPlants as ReturnType<typeof vi.fn>

const knownPlant = {
  id: 'plant-1',
  genus: 'Salvia',
  species: 'rosmarinus',
  commonName: 'Rosemary',
  primaryImage: null,
  values: [
    {
      attributeId: 'a-hiz',
      attributeName: 'Home Ignition Zone',
      rawValue: '02',
      resolved: { value: '5-10', type: 'string', id: 'z2' },
    },
    {
      attributeId: 'a-drought',
      attributeName: 'Drought tolerance',
      rawValue: '03',
      resolved: { value: 'High', type: 'string', id: 'h' },
    },
    {
      attributeId: 'a-empty',
      attributeName: 'Empty attr',
      rawValue: '',
      resolved: { value: '', type: 'string', id: 'e' },
    },
  ],
}

function makeEntry(overrides: Partial<PlantEntry> = {}): PlantEntry {
  return {
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
    ...overrides,
  }
}

function renderLightbox(entry: PlantEntry, plants = [knownPlant]) {
  mockFetchPlants.mockResolvedValue({
    data: plants,
    meta: { pagination: { total: plants.length, limit: 50, offset: 0, hasMore: false } },
  })
  const onClose = vi.fn()
  const onMove = vi.fn()
  const onDelete = vi.fn()
  const onUpdateNotes = vi.fn().mockResolvedValue(undefined)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={qc}>
      <PlantLightbox
        entry={entry}
        onClose={onClose}
        onMove={onMove}
        onDelete={onDelete}
        onUpdateNotes={onUpdateNotes}
      />
    </QueryClientProvider>,
  )
  return { ...utils, onClose, onMove, onDelete, onUpdateNotes }
}

beforeEach(() => {
  mockFetchPlants.mockReset()
})

describe('PlantLightbox shell', () => {
  it('renders a dialog with aria-labelledby pointing to the title', () => {
    renderLightbox(makeEntry())
    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const title = document.getElementById(labelledBy!)
    expect(title?.textContent).toBe('Rosemary')
  })

  it('ESC closes the dialog', () => {
    const { onClose } = renderLightbox(makeEntry())
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('clicking the backdrop closes the dialog; clicking inside does not', () => {
    const { onClose } = renderLightbox(makeEntry())
    const backdrop = document.body.querySelector('.plant-lightbox-backdrop')!
    const inner = document.body.querySelector('.plant-lightbox')!
    fireEvent.mouseDown(inner)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('move chips call onMove with the new zone and dialog stays open', () => {
    const { onMove, onClose } = renderLightbox(makeEntry({ zone: '5-10' }))
    fireEvent.click(screen.getByLabelText('Move to Zone 10-30'))
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }), '10-30')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('the current-zone chip is disabled', () => {
    renderLightbox(makeEntry({ zone: '5-10' }))
    const currentChip = screen.getByLabelText('Move to Zone 5-10') as HTMLButtonElement
    expect(currentChip.disabled).toBe(true)
  })

  it('Delete closes the dialog before invoking onDelete', () => {
    const calls: string[] = []
    const { onClose, onDelete } = renderLightbox(makeEntry())
    onClose.mockImplementation(() => calls.push('close'))
    onDelete.mockImplementation(() => calls.push('delete'))
    fireEvent.click(screen.getByLabelText('Delete Rosemary'))
    expect(calls).toEqual(['close', 'delete'])
  })

  it('embeds a chat panel pre-seeded with the plant + zone in the input', () => {
    renderLightbox(makeEntry({ plant_name: 'Rosemary', zone: '5-10' }))
    const input = screen.getByPlaceholderText(
      'Ask about fire-resilient landscaping...',
    ) as HTMLInputElement
    expect(input.value).toContain('Rosemary')
    expect(input.value).toMatch(/Zone 2|5–10/)
  })

  it('initial focus lands on the first non-disabled move chip', async () => {
    renderLightbox(makeEntry({ zone: '5-10' }))
    // First non-disabled chip is Zone 1 (0-5) since Zone 2 is current/disabled.
    await waitFor(() => {
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Move to Zone 0-5')
    })
  })

  it('has no axe violations (known plant variant)', async () => {
    const { container } = renderLightbox(makeEntry())
    expect(await axeCheck(container)).toHaveNoViolations()
  })

  it('has no axe violations (custom item variant)', async () => {
    const { container } = renderLightbox(
      makeEntry({ plant_id: null, plant_name: 'Compost pile', notes: 'My pile' }),
    )
    expect(await axeCheck(container)).toHaveNoViolations()
  })
})

describe('PlantLightboxKnown body', () => {
  it('renders each non-empty value as <dt>/<dd>', async () => {
    renderLightbox(makeEntry())
    expect(await screen.findByText('Home Ignition Zone')).toBeInTheDocument()
    expect(screen.getByText('Drought tolerance')).toBeInTheDocument()
    // The HIZ value "5-10" also appears in chip aria-labels; scope to <dd>s only.
    const dds = document.querySelectorAll('dd')
    const ddValues = Array.from(dds).map((el) => el.textContent)
    expect(ddValues).toContain('5-10')
    expect(ddValues).toContain('High')
    // Empty value is skipped.
    expect(screen.queryByText('Empty attr')).toBeNull()
  })

  it('renders the scientific name with lang="la"', async () => {
    renderLightbox(makeEntry())
    const scientific = await screen.findByText(/Salvia rosmarinus/)
    expect(scientific.getAttribute('lang')).toBe('la')
  })
})

describe('PlantLightboxCustom body', () => {
  it('seeds the textarea from entry.notes', () => {
    renderLightbox(makeEntry({ plant_id: null, notes: 'My existing notes' }))
    const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement
    expect(textarea.value).toBe('My existing notes')
  })

  it('Save is disabled when the description is unchanged', () => {
    renderLightbox(makeEntry({ plant_id: null, notes: 'Same' }))
    expect((screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('Save calls onUpdateNotes with the new draft text', async () => {
    const { onUpdateNotes } = renderLightbox(
      makeEntry({ plant_id: null, notes: '' }),
    )
    const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'A 3 ft compost pile' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    await waitFor(() =>
      expect(onUpdateNotes).toHaveBeenCalledWith(
        expect.objectContaining({ plant_id: null }),
        'A 3 ft compost pile',
      ),
    )
  })

  it('Cancel reverts the draft to the original notes', () => {
    renderLightbox(makeEntry({ plant_id: null, notes: 'Original' }))
    const textarea = screen.getByLabelText('Description') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Dirty edit' } })
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }))
    expect(textarea.value).toBe('Original')
  })
})
