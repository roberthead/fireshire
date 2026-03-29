import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MapContext, type MapContextValue } from '../contexts/MapContext'
import { ZoneLegend } from './ZoneLegend'

function createMockContext(overrides: Partial<MapContextValue> = {}): MapContextValue {
  return {
    map: null,
    setMap: vi.fn(),
    zoneVisibility: { zone1: true, zone2: true, zone3: true, zone4: true },
    toggleZoneVisibility: vi.fn(),
    zonesReady: true,
    setZonesReady: vi.fn(),
    ...overrides,
  }
}

function renderWithContext(ctx: MapContextValue) {
  return render(
    <MapContext.Provider value={ctx}>
      <ZoneLegend />
    </MapContext.Provider>,
  )
}

// Mock matchMedia for desktop by default
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

describe('ZoneLegend', () => {
  it('renders all four zone entries with names, distances, and strategies', () => {
    renderWithContext(createMockContext())
    expect(screen.getByText(/Zone 1 \(0–5 ft\)/)).toBeInTheDocument()
    expect(screen.getByText(/Zone 2 \(5–10 ft\)/)).toBeInTheDocument()
    expect(screen.getByText(/Zone 3 \(10–30 ft\)/)).toBeInTheDocument()
    expect(screen.getByText(/Zone 4 \(30–100 ft\)/)).toBeInTheDocument()
    expect(screen.getByText('Non-combustible zone')).toBeInTheDocument()
    expect(screen.getByText('Ember catch zone')).toBeInTheDocument()
    expect(screen.getByText('Lean, clean, green planting')).toBeInTheDocument()
    expect(screen.getByText('Reduce fuel continuity')).toBeInTheDocument()
  })

  it('calls toggleZoneVisibility with correct zone ID on click', () => {
    const toggle = vi.fn()
    renderWithContext(createMockContext({ toggleZoneVisibility: toggle }))
    fireEvent.click(screen.getByText(/Zone 2 \(5–10 ft\)/).closest('button')!)
    expect(toggle).toHaveBeenCalledWith('zone2')
  })

  it('shows reduced opacity for toggled-off zone', () => {
    const ctx = createMockContext({ zoneVisibility: { zone1: false, zone2: true, zone3: true, zone4: true } })
    renderWithContext(ctx)
    const btn = screen.getByText(/Zone 1 \(0–5 ft\)/).closest('button')!
    expect(btn.style.opacity).toBe('0.4')
  })

  it('disables buttons when zones are not ready', () => {
    renderWithContext(createMockContext({ zonesReady: false }))
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => expect(btn).toBeDisabled())
  })

  it('sets aria-pressed matching visibility state', () => {
    const ctx = createMockContext({ zoneVisibility: { zone1: false, zone2: true, zone3: true, zone4: true } })
    renderWithContext(ctx)
    const zone1Btn = screen.getByText(/Zone 1 \(0–5 ft\)/).closest('button')!
    const zone2Btn = screen.getByText(/Zone 2 \(5–10 ft\)/).closest('button')!
    expect(zone1Btn.getAttribute('aria-pressed')).toBe('false')
    expect(zone2Btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('renders compact icon on mobile viewport', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    renderWithContext(createMockContext())
    expect(screen.getByLabelText('Show zone legend')).toBeInTheDocument()
    expect(screen.queryByText(/Zone 1/)).not.toBeInTheDocument()
  })

  it('expands on tap in mobile mode', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    renderWithContext(createMockContext())
    fireEvent.click(screen.getByLabelText('Show zone legend'))
    expect(screen.getByText(/Zone 1 \(0–5 ft\)/)).toBeInTheDocument()
  })
})
