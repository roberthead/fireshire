import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPlants, ApiError, type Plant } from '../lib/api'
import { plantMatchesSearch } from '../lib/plantSearch'
import { StatusBanner } from './StatusBanner'
import { ChatPanel } from './ChatPanel'

export interface PlantPanelProps {
  address?: string
  zones: string[]
  onClose: () => void
}

const ZONE_COLORS: Record<string, string> = {
  '0-5': '#e53e3e',
  '5-10': '#ed8936',
  '10-30': '#ecc94b',
  '30-100': '#48bb78',
}

const HIZ_ATTRIBUTE_ID = 'b908b170-70c9-454d-a2ed-d86f98cb3de1'

function getPlantZones(plant: Plant): string[] {
  return plant.values
    .filter((v) => v.attributeId === HIZ_ATTRIBUTE_ID)
    .map((v) => v.resolved.value)
}

function badgeColor(zone: string): string {
  return zone === '10-30' ? '#000' : '#fff'
}

export function PlantPanel({ address, zones, onClose }: PlantPanelProps) {
  const [activeTab, setActiveTab] = useState<'plants' | 'chat'>('plants')

  const {
    data,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['plants', zones],
    queryFn: () => fetchPlants(zones),
    enabled: zones.length > 0,
  })

  const [searchQuery, setSearchQuery] = useState('')

  const filteredPlants = useMemo(() => {
    if (!data) return []
    return data.data.filter((plant) => {
      const plantZones = getPlantZones(plant)
      return plantZones.some((z) => zones.includes(z))
    })
  }, [data, zones])

  const searchedPlants = searchQuery
    ? filteredPlants.filter((p) => plantMatchesSearch(p, searchQuery))
    : filteredPlants

  if (isFetching) {
    return <StatusBanner variant="loading" message="Finding plants..." />
  }

  if (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'Failed to load plant recommendations.'
    return <StatusBanner variant="error" message={message} onRetry={() => refetch()} />
  }

  return (
    <div
      style={{
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 8,
        padding: '0.75rem',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <div />
        <button
          onClick={onClose}
          aria-label="Close plant panel"
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: 0,
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          &times;
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          marginBottom: '0.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('plants')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'plants'
              ? '2px solid var(--color-fire, #4CAF50)'
              : '2px solid transparent',
            color: activeTab === 'plants'
              ? '#fff'
              : 'var(--color-text-muted, #94a3b8)',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
            minHeight: 44,
          }}
        >
          Plants{filteredPlants.length > 0 && (
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                background: 'rgba(255,255,255,0.15)',
                color: '#e2e8f0',
                padding: '1px 6px',
                borderRadius: 3,
                marginLeft: 4,
              }}
            >
              {searchQuery && activeTab === 'plants'
                ? `${searchedPlants.length} of ${filteredPlants.length}`
                : filteredPlants.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'chat'
              ? '2px solid var(--color-fire, #4CAF50)'
              : '2px solid transparent',
            color: activeTab === 'chat'
              ? '#fff'
              : 'var(--color-text-muted, #94a3b8)',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
            minHeight: 44,
          }}
        >
          Chat
        </button>
      </div>

      {activeTab === 'chat' ? (
        <ChatPanel address={address} zones={zones} plants={filteredPlants} />
      ) : (
        <>
          <input
            type="search"
            placeholder="Search plants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              marginBottom: '0.5rem',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4,
              color: '#e2e8f0',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />

          {/* Body */}
          <div
            style={{
              maxHeight: '50vh',
              overflowY: 'auto',
              margin: '0 -0.75rem',
              padding: '0 0.75rem',
            }}
          >
            {searchedPlants.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {searchQuery
                  ? 'No plants match your search.'
                  : 'No plants recommended for the active zones.'}
              </p>
            )}

            {searchedPlants.map((plant, i) => {
              const plantZones = getPlantZones(plant).filter((z) => zones.includes(z))
              return (
                <div
                  key={plant.id}
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    padding: '0.5rem 0',
                    borderBottom:
                      i < searchedPlants.length - 1
                        ? '1px solid rgba(255,255,255,0.08)'
                        : 'none',
                  }}
                >
                  {/* Thumbnail */}
                  {plant.primaryImage ? (
                    <img
                      src={plant.primaryImage.url}
                      alt={plant.commonName || 'Plant'}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 4,
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.1)',
                        flexShrink: 0,
                      }}
                    />
                  )}

                  {/* Text */}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--color-text)',
                      }}
                    >
                      {plant.commonName || 'Unknown'}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        fontStyle: 'italic',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {plant.genus ?? ''} {plant.species ?? ''}
                    </div>
                    {/* Zone badges */}
                    <div
                      style={{
                        display: 'inline-flex',
                        gap: 4,
                        marginTop: 4,
                      }}
                    >
                      {plantZones.map((z) => (
                        <span
                          key={z}
                          style={{
                            padding: '1px 6px',
                            borderRadius: 3,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            background: ZONE_COLORS[z] ?? 'rgba(255,255,255,0.15)',
                            color: badgeColor(z),
                          }}
                        >
                          {z} ft
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination info */}
          {data && data.meta.pagination.hasMore && (
            <p
              style={{
                fontSize: '0.7rem',
                color: '#94a3b8',
                marginTop: '0.5rem',
                textAlign: 'center',
              }}
            >
              Showing {searchedPlants.length} of {data.meta.pagination.total} plants
            </p>
          )}
        </>
      )}
    </div>
  )
}
