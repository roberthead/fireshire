import type { Plant } from './api'

export function plantMatchesSearch(plant: Plant, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  if (plant.commonName?.toLowerCase().includes(q)) return true
  if (plant.genus?.toLowerCase().includes(q)) return true
  if (plant.species?.toLowerCase().includes(q)) return true
  for (const v of plant.values) {
    if (v.attributeName?.toLowerCase().includes(q)) return true
    if (typeof v.resolved?.value === 'string' && v.resolved.value.toLowerCase().includes(q)) return true
  }
  return false
}
