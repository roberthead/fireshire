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
  const groupedValues = groupValuesByAttribute(plant.values)
  const caption = plant.primaryImage?.caption?.trim()

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
        <figure className="plant-lightbox__figure">
          <img
            src={plant.primaryImage.url}
            alt={caption ?? ''}
            className="plant-lightbox__hero"
            loading="lazy"
            decoding="async"
          />
          {caption && (
            <figcaption className="plant-lightbox__caption">{caption}</figcaption>
          )}
        </figure>
      )}

      {groupedValues.length > 0 && (
        <dl className="plant-lightbox__values">
          {groupedValues.map((g) => (
            <div key={g.attributeId} className="plant-lightbox__value-row">
              <dt>{g.attributeName}</dt>
              <dd>{g.values.join(', ')}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}

interface GroupedValue {
  attributeId: string
  attributeName: string
  values: string[]
}

function groupValuesByAttribute(
  values: Plant['values'],
): GroupedValue[] {
  const order: string[] = []
  const groups = new Map<string, GroupedValue>()
  for (const v of values) {
    const text = v.resolved?.value
    if (typeof text !== 'string' || text.length === 0) continue
    const existing = groups.get(v.attributeId)
    if (existing) {
      if (!existing.values.includes(text)) existing.values.push(text)
      continue
    }
    order.push(v.attributeId)
    groups.set(v.attributeId, {
      attributeId: v.attributeId,
      attributeName: v.attributeName,
      values: [text],
    })
  }
  return order.map((id) => groups.get(id)!)
}
