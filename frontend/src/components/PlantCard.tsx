import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPlants, type Plant, type PlantEntry, type ZoneKey } from '../lib/api'

const ALL_ZONES: ZoneKey[] = ['0-5', '5-10', '10-30', '30-100']

export interface PlantCardProps {
  entry: PlantEntry
  onOpen: (entry: PlantEntry) => void
}

const ZONE_LABEL: Record<ZoneKey, string> = {
  '0-5': 'Zone 1',
  '5-10': 'Zone 2',
  '10-30': 'Zone 3',
  '30-100': 'Zone 4',
}

export function PlantCard({ entry, onOpen }: PlantCardProps) {
  const isCustom = entry.plant_id === null

  const { data } = useQuery({
    queryKey: ['plants', ALL_ZONES],
    queryFn: () => fetchPlants(ALL_ZONES),
    enabled: !isCustom,
  })
  const plant: Plant | null = useMemo(() => {
    if (isCustom || !data) return null
    return data.data.find((p) => p.id === entry.plant_id) ?? null
  }, [data, entry.plant_id, isCustom])

  const imageUrl = plant?.primaryImage?.url ?? null
  const zoneLabel = ZONE_LABEL[entry.zone as ZoneKey] ?? entry.zone

  return (
    <button
      type="button"
      className="plant-card"
      data-custom={isCustom || undefined}
      aria-haspopup="dialog"
      aria-label={`${entry.plant_name}, ${zoneLabel}. Open details`}
      onClick={() => onOpen(entry)}
    >
      <div className="plant-card__media">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="plant-card__image"
          />
        ) : (
          <div className="plant-card__fallback" aria-hidden="true">
            <span>{isCustom ? '📍' : '🌱'}</span>
          </div>
        )}
      </div>
      <div className="plant-card__title-bar">
        <span className="plant-card__title">{entry.plant_name}</span>
      </div>
    </button>
  )
}
