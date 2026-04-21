import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPlants, type Plant, type ZoneKey } from '../lib/api'
import { plantMatchesSearch } from '../lib/plantSearch'
import {
  SUITABILITY_COLOR,
  SUITABILITY_ICON,
  SUITABILITY_LABEL,
  suitabilityFor,
} from '../lib/plantZoneCompatibility'

const ALL_ZONES: ZoneKey[] = ['0-5', '5-10', '10-30', '30-100']

export interface AddPlantComboboxProps {
  zone: ZoneKey
  onCommit: (selection: { plant: Plant | null; label: string }) => void
  onCancel: () => void
}

export function AddPlantCombobox({ zone, onCommit, onCancel }: AddPlantComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const optionIdPrefix = useId()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const { data } = useQuery({
    queryKey: ['plants', ALL_ZONES],
    queryFn: () => fetchPlants(ALL_ZONES),
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const matches = useMemo(() => {
    if (!data) return []
    if (!query.trim()) return []
    return data.data.filter((p) => plantMatchesSearch(p, query)).slice(0, 8)
  }, [data, query])

  // Last option is always "Add '[typed]' as custom entry" when there's query text
  const showCustomOption = query.trim().length > 0
  const totalOptions = matches.length + (showCustomOption ? 1 : 0)
  const customIndex = matches.length
  const boundedActiveIndex =
    totalOptions === 0 ? 0 : Math.min(activeIndex, totalOptions - 1)

  function commit(index: number) {
    if (index === customIndex && showCustomOption) {
      onCommit({ plant: null, label: query.trim().slice(0, 100) })
      return
    }
    const plant = matches[index]
    if (!plant) return
    const label = (plant.commonName ?? `${plant.genus ?? ''} ${plant.species ?? ''}`.trim()).slice(0, 100)
    onCommit({ plant, label })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (totalOptions > 0) setActiveIndex((boundedActiveIndex + 1) % totalOptions)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (totalOptions > 0) setActiveIndex((boundedActiveIndex - 1 + totalOptions) % totalOptions)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (totalOptions > 0) commit(boundedActiveIndex)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  const activeId =
    totalOptions > 0 ? `${optionIdPrefix}-opt-${boundedActiveIndex}` : undefined

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={totalOptions > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-label={`Search or add a plant for Zone ${zone}`}
        placeholder="Search plants or type to add custom..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value.slice(0, 100))
          setActiveIndex(0)
        }}
        onKeyDown={handleKeyDown}
        maxLength={100}
        style={{
          width: '100%',
          minHeight: 44,
          padding: '0.4rem 0.6rem',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 4,
          color: '#e2e8f0',
          fontSize: '0.8rem',
          outline: 'none',
        }}
      />
      {totalOptions > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`Plant suggestions for Zone ${zone}`}
          style={{
            listStyle: 'none',
            margin: '2px 0 0',
            padding: 0,
            background: 'var(--color-charcoal)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 4,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {matches.map((plant, i) => {
            const suit = suitabilityFor(plant, zone)
            return (
              <li
                key={plant.id}
                id={`${optionIdPrefix}-opt-${i}`}
                role="option"
                aria-selected={boundedActiveIndex === i}
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(i)
                }}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  padding: '0.4rem 0.6rem',
                  minHeight: 44,
                  cursor: 'pointer',
                  background:
                    boundedActiveIndex === i ? 'rgba(255,255,255,0.1)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                    {plant.commonName ?? (`${plant.genus ?? ''} ${plant.species ?? ''}`.trim() || 'Unknown')}
                  </div>
                  {(plant.genus || plant.species) && (
                    <div
                      lang="la"
                      style={{
                        fontSize: '0.7rem',
                        fontStyle: 'italic',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {plant.genus ?? ''} {plant.species ?? ''}
                    </div>
                  )}
                </div>
                <span
                  aria-label={`${SUITABILITY_LABEL[suit]} for zone ${zone}`}
                  style={{
                    fontSize: '0.65rem',
                    color: SUITABILITY_COLOR[suit],
                    whiteSpace: 'nowrap',
                  }}
                >
                  {SUITABILITY_ICON[suit]} {SUITABILITY_LABEL[suit]}
                </span>
              </li>
            )
          })}
          {showCustomOption && (
            <li
              id={`${optionIdPrefix}-opt-${customIndex}`}
              role="option"
              aria-selected={boundedActiveIndex === customIndex}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(customIndex)
              }}
              onMouseEnter={() => setActiveIndex(customIndex)}
              style={{
                padding: '0.4rem 0.6rem',
                minHeight: 44,
                cursor: 'pointer',
                background:
                  boundedActiveIndex === customIndex
                    ? 'rgba(255,255,255,0.1)'
                    : 'transparent',
                borderTop: matches.length > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                fontSize: '0.8rem',
                color: '#e2e8f0',
              }}
            >
              Add &ldquo;{query.trim()}&rdquo; as custom entry
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
