import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPlants, type PlantEntry, type ZoneKey, type Plant } from '../lib/api'
import {
  SUITABILITY_COLOR,
  SUITABILITY_ICON,
  SUITABILITY_LABEL,
  getPlantRatedZones,
  suitabilityFor,
} from '../lib/plantZoneCompatibility'

const ALL_ZONES: ZoneKey[] = ['0-5', '5-10', '10-30', '30-100']

export interface PlantEntryRowProps {
  entry: PlantEntry
  onMove: (entry: PlantEntry, nextZone: ZoneKey) => void
  onDelete: (entry: PlantEntry) => void
  onAskRascal: (entry: PlantEntry) => void
}

export function PlantEntryRow({ entry, onMove, onDelete, onAskRascal }: PlantEntryRowProps) {
  // Fetch all plants once (cached) so we can resolve this entry's metadata
  const { data } = useQuery({
    queryKey: ['plants', ALL_ZONES],
    queryFn: () => fetchPlants(ALL_ZONES),
    enabled: entry.plant_id !== null,
  })

  const plant: Plant | null = useMemo(() => {
    if (!entry.plant_id || !data) return null
    return data.data.find((p) => p.id === entry.plant_id) ?? null
  }, [data, entry.plant_id])

  const suit = suitabilityFor(plant, entry.zone as ZoneKey)
  const ratedZones = plant ? getPlantRatedZones(plant) : []
  const showMismatch = suit === 'caution' && ratedZones.length > 0

  const scientific = plant
    ? `${plant.genus ?? ''} ${plant.species ?? ''}`.trim()
    : ''

  return (
    <li
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        padding: '0.5rem 0',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 500 }}>
            {entry.plant_name}
          </div>
          {scientific && (
            <div
              lang="la"
              style={{
                fontSize: '0.7rem',
                fontStyle: 'italic',
                color: 'var(--color-text-muted)',
              }}
            >
              {scientific}
            </div>
          )}
          <div style={{ marginTop: '0.2rem' }}>
            <span
              aria-label={`Suitability: ${SUITABILITY_LABEL[suit]}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.7rem',
                fontWeight: 600,
                color: SUITABILITY_COLOR[suit],
                background: 'rgba(255,255,255,0.08)',
                padding: '2px 6px',
                borderRadius: 3,
              }}
            >
              <span aria-hidden="true">{SUITABILITY_ICON[suit]}</span>
              {SUITABILITY_LABEL[suit]}
            </span>
          </div>
          {showMismatch && (
            <div
              style={{
                fontSize: '0.7rem',
                color: '#fcd34d',
                marginTop: '0.2rem',
              }}
            >
              Not rated for Zone {entry.zone}. Rated: {ratedZones.join(', ')}.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onAskRascal(entry)}
          aria-label={`Ask Rascal about ${entry.plant_name}`}
          title="Ask Rascal about this plant"
          style={{
            minWidth: 44,
            minHeight: 44,
            background: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
            color: 'var(--color-shire)',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          <span aria-hidden="true">💬</span>
        </button>

        <button
          type="button"
          onClick={() => onDelete(entry)}
          aria-label={`Delete ${entry.plant_name}`}
          style={{
            minWidth: 44,
            minHeight: 44,
            background: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
            color: '#fca5a5',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          <span aria-hidden="true">🗑</span>
        </button>
      </div>

      {/* Move control — 4 zone chips; current zone disabled */}
      <div
        role="group"
        aria-label={`Move ${entry.plant_name} to another zone`}
        style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
      >
        {ALL_ZONES.map((z) => {
          const isCurrent = z === entry.zone
          return (
            <button
              key={z}
              type="button"
              disabled={isCurrent}
              onClick={() => onMove(entry, z)}
              aria-label={`Move to Zone ${z}`}
              aria-current={isCurrent ? 'true' : undefined}
              style={{
                minHeight: 44,
                minWidth: 44,
                padding: '0 0.5rem',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 4,
                background: isCurrent
                  ? 'rgba(76,175,80,0.2)'
                  : 'rgba(255,255,255,0.05)',
                color: isCurrent ? '#94a3b8' : '#e2e8f0',
                cursor: isCurrent ? 'default' : 'pointer',
                fontSize: '0.7rem',
              }}
            >
              {z}
            </button>
          )
        })}
      </div>
    </li>
  )
}
