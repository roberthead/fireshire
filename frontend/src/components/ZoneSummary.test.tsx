import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { featureCollection } from '@turf/turf'
import type { ZoneResult } from '../lib/computeZoneRings'
import { ZoneSummary } from './ZoneSummary'

const emptyZones: ZoneResult = {
  zone1: featureCollection([]),
  zone2: featureCollection([]),
  zone3: featureCollection([]),
  zone4: featureCollection([]),
}

describe('ZoneSummary', () => {
  it('renders section with aria-labelledby', () => {
    render(<ZoneSummary address="455 Siskiyou Blvd" buildingCount={3} zones={emptyZones} />)
    const section = screen.getByRole('region')
    expect(section).toHaveAttribute('aria-labelledby', 'zone-summary-heading')
  })

  it('contains h2 with text Zone Summary', () => {
    render(<ZoneSummary address="455 Siskiyou Blvd" buildingCount={3} zones={emptyZones} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('Zone Summary')
  })

  it('displays property address and building count', () => {
    render(<ZoneSummary address="455 Siskiyou Blvd" buildingCount={3} zones={emptyZones} />)
    expect(screen.getByText(/Property: 455 Siskiyou Blvd/)).toBeInTheDocument()
    expect(screen.getByText(/Buildings detected: 3/)).toBeInTheDocument()
  })

  it('renders each zone distance band and area', () => {
    render(<ZoneSummary address="455 Siskiyou Blvd" buildingCount={3} zones={emptyZones} />)
    expect(screen.getByText(/Zone 1 \(0–5 ft\)/)).toBeInTheDocument()
    expect(screen.getByText(/Zone 2 \(5–10 ft\)/)).toBeInTheDocument()
    expect(screen.getByText(/Zone 3 \(10–30 ft\)/)).toBeInTheDocument()
    expect(screen.getByText(/Zone 4 \(30–100 ft\)/)).toBeInTheDocument()
  })

  it('contains aria-live polite announcement', () => {
    render(<ZoneSummary address="455 Siskiyou Blvd" buildingCount={3} zones={emptyZones} />)
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeInTheDocument()
    expect(liveRegion).toHaveTextContent('Zone analysis complete for 455 Siskiyou Blvd')
  })
})
