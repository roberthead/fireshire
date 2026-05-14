import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPlants, type Plant, type PlantEntry, type ZoneKey } from '../lib/api'
import {
  SUITABILITY_COLOR,
  SUITABILITY_ICON,
  SUITABILITY_LABEL,
  suitabilityFor,
} from '../lib/plantZoneCompatibility'

const ALL_ZONES: ZoneKey[] = ['0-5', '5-10', '10-30', '30-100']

export interface PlantLightboxKnownProps {
  entry: PlantEntry
}

export function PlantLightboxKnown({ entry }: PlantLightboxKnownProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['plants', ALL_ZONES],
    queryFn: () => fetchPlants(ALL_ZONES),
  })

  const plant: Plant | null = useMemo(() => {
    if (!data || !entry.plant_id) return null
    return data.data.find((p) => p.id === entry.plant_id) ?? null
  }, [data, entry.plant_id])

  if (isLoading) {
    return <p className="plant-lightbox__loading">Loading details…</p>
  }

  if (!plant) {
    return (
      <p className="plant-lightbox__loading">
        Details unavailable for this plant.
      </p>
    )
  }

  const suit = suitabilityFor(plant, entry.zone as ZoneKey)
  const scientific = `${plant.genus ?? ''} ${plant.species ?? ''}`.trim()

  const values = plant.values.filter((v) => {
    const raw = v.resolved?.value
    return typeof raw === 'string' && raw.length > 0
  })

  return (
    <>
      <div className="plant-lightbox__meta">
        {scientific && (
          <p lang="la" className="plant-lightbox__scientific">
            {scientific}
          </p>
        )}
        <span
          aria-label={`Suitability: ${SUITABILITY_LABEL[suit]}`}
          className="plant-lightbox__suitability"
          style={{ color: SUITABILITY_COLOR[suit] }}
        >
          <span aria-hidden="true">{SUITABILITY_ICON[suit]}</span>{' '}
          {SUITABILITY_LABEL[suit]}
        </span>
      </div>

      {plant.primaryImage?.url && (
        <img
          src={plant.primaryImage.url}
          alt={plant.primaryImage.caption ?? ''}
          className="plant-lightbox__hero"
          loading="lazy"
          decoding="async"
        />
      )}

      {values.length > 0 && (
        <dl className="plant-lightbox__values">
          {values.map((v) => (
            <div key={v.attributeId} className="plant-lightbox__value-row">
              <dt>{v.attributeName}</dt>
              <dd>{v.resolved.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}
