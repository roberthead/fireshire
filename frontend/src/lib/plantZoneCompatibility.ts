import type { Plant, ZoneKey } from './api'

const HIZ_ATTRIBUTE_ID = 'b908b170-70c9-454d-a2ed-d86f98cb3de1'

export function getPlantRatedZones(plant: Plant): string[] {
  return plant.values
    .filter((v) => v.attributeId === HIZ_ATTRIBUTE_ID)
    .map((v) => v.resolved.value)
}

export type Suitability = 'compatible' | 'caution' | 'not_rated'

export function suitabilityFor(plant: Plant | null, zone: ZoneKey): Suitability {
  if (!plant) return 'not_rated'
  const rated = getPlantRatedZones(plant)
  if (rated.length === 0) return 'not_rated'
  return rated.includes(zone) ? 'compatible' : 'caution'
}

export const SUITABILITY_LABEL: Record<Suitability, string> = {
  compatible: 'Compatible',
  caution: 'Use caution',
  not_rated: 'Not rated',
}

export const SUITABILITY_ICON: Record<Suitability, string> = {
  compatible: '✓',
  caution: '⚠',
  not_rated: '?',
}

export const SUITABILITY_COLOR: Record<Suitability, string> = {
  compatible: '#48bb78',
  caution: '#ed8936',
  not_rated: '#94a3b8',
}
