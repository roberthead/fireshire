import type { PlantEntry } from '../lib/api'
import { PlantCard } from './PlantCard'

export interface PlantCardGridProps {
  entries: PlantEntry[]
  onOpen: (entry: PlantEntry) => void
}

export function PlantCardGrid({ entries, onOpen }: PlantCardGridProps) {
  if (entries.length === 0) return null
  return (
    <div className="plant-card-grid">
      {entries.map((entry) => (
        <PlantCard key={entry.id} entry={entry} onOpen={onOpen} />
      ))}
    </div>
  )
}
