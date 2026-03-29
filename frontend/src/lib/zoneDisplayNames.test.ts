import { describe, it, expect } from 'vitest'
import { activeZoneDisplayNames } from './zoneDisplayNames'

describe('activeZoneDisplayNames', () => {
  it('returns all zone names when all visible', () => {
    const visibility = { zone1: true, zone2: true, zone3: true, zone4: true }
    expect(activeZoneDisplayNames(visibility)).toEqual([
      '0-5',
      '5-10',
      '10-30',
      '30-100',
    ])
  })

  it('returns only visible zone names', () => {
    const visibility = { zone1: false, zone2: true, zone3: false, zone4: true }
    expect(activeZoneDisplayNames(visibility)).toEqual(['5-10', '30-100'])
  })

  it('returns empty array when none visible', () => {
    const visibility = {
      zone1: false,
      zone2: false,
      zone3: false,
      zone4: false,
    }
    expect(activeZoneDisplayNames(visibility)).toEqual([])
  })

  it('ignores unknown zone keys', () => {
    const visibility = { zone1: true, zone5: true }
    expect(activeZoneDisplayNames(visibility)).toEqual(['0-5'])
  })
})
