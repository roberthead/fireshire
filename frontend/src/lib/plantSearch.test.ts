import { describe, it, expect } from 'vitest'
import { plantMatchesSearch } from './plantSearch'
import type { Plant } from './api'

const makePlant = (overrides: Partial<Plant> = {}): Plant => ({
  id: 'test-1',
  genus: 'Acer',
  species: 'palmatum',
  commonName: 'Japanese maple',
  primaryImage: null,
  values: [
    {
      attributeId: 'attr-1',
      attributeName: 'Home Ignition Zone (HIZ)',
      rawValue: '03',
      resolved: { value: '10-30', type: 'text', id: 'val-1' },
    },
    {
      attributeId: 'attr-2',
      attributeName: 'Flammability Notes',
      rawValue: 'note',
      resolved: { value: 'Low flammability, good fire resistance', type: 'text', id: 'val-2' },
    },
  ],
  ...overrides,
})

describe('plantMatchesSearch', () => {
  it('matches on commonName', () => {
    expect(plantMatchesSearch(makePlant(), 'maple')).toBe(true)
  })

  it('matches on genus', () => {
    expect(plantMatchesSearch(makePlant(), 'acer')).toBe(true)
  })

  it('matches on species', () => {
    expect(plantMatchesSearch(makePlant(), 'palmatum')).toBe(true)
  })

  it('matches on attribute resolved value', () => {
    expect(plantMatchesSearch(makePlant(), 'fire resistance')).toBe(true)
  })

  it('matches on attribute name', () => {
    expect(plantMatchesSearch(makePlant(), 'flammability')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(plantMatchesSearch(makePlant(), 'JAPANESE')).toBe(true)
    expect(plantMatchesSearch(makePlant(), 'ACER')).toBe(true)
  })

  it('returns true for empty query', () => {
    expect(plantMatchesSearch(makePlant(), '')).toBe(true)
  })

  it('returns false when no field matches', () => {
    expect(plantMatchesSearch(makePlant(), 'sunflower')).toBe(false)
  })
})
