import { useState, useMemo, useEffect, useRef, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchParcels, ApiError, type Parcel, type Suggestion } from '../lib/api'
import { useMapContext } from '../hooks/useMapContext'
import { StatusBanner } from './StatusBanner'

function showParcelOnMap(map: mapboxgl.Map, parcel: Parcel) {
  if (!parcel.centroid) return
  map.flyTo({ center: [parcel.centroid.lng, parcel.centroid.lat], zoom: 18 })

  if (map.getSource('parcel')) {
    (map.getSource('parcel') as mapboxgl.GeoJSONSource).setData(parcel.geometry)
  } else {
    map.addSource('parcel', { type: 'geojson', data: parcel.geometry })
    map.addLayer({
      id: 'parcel-fill',
      type: 'fill',
      source: 'parcel',
      paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.05 },
    })
    map.addLayer({
      id: 'parcel-outline',
      type: 'line',
      source: 'parcel',
      paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-dasharray': [3, 2] },
    })
  }
}

export function AddressSearch({
  initialAddress,
  onParcelSelected,
}: {
  initialAddress?: string
  onParcelSelected?: (parcel: Parcel) => void
}) {
  const [address, setAddress] = useState(initialAddress || '')
  const [searchAddress, setSearchAddress] = useState(initialAddress || '')
  const [listDismissed, setListDismissed] = useState(false)
  const { map } = useMapContext()
  const autoSelectedRef = useRef('')

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ['parcels', searchAddress],
    queryFn: () => fetchParcels(searchAddress),
    enabled: searchAddress.length > 0,
  })

  const parcels = useMemo(() => data?.parcels ?? [], [data])
  const suggestions = useMemo(() => data?.suggestions ?? [], [data])

  // Auto-select single result
  useEffect(() => {
    if (parcels.length === 1 && !isFetching && map) {
      const parcel = parcels[0]
      const key = `${searchAddress}:${parcel.taxlot_id}`
      if (autoSelectedRef.current !== key) {
        autoSelectedRef.current = key
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing input with fetched data
        setAddress(parcel.address)
        showParcelOnMap(map, parcel)
        onParcelSelected?.(parcel)
      }
    }
  }, [parcels, isFetching, map, searchAddress, onParcelSelected])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (address.trim().length < 2) return
    autoSelectedRef.current = ''
    setListDismissed(false)
    setSearchAddress(address.trim())
  }

  function handleSelect(parcel: Parcel) {
    setAddress(parcel.address)
    setListDismissed(true)
    if (map) showParcelOnMap(map, parcel)
    onParcelSelected?.(parcel)
  }

  function handleSuggestionClick(suggestion: Suggestion) {
    autoSelectedRef.current = ''
    setListDismissed(false)
    setAddress(suggestion.address)
    setSearchAddress(suggestion.address)
  }

  const showResults = searchAddress.length > 0 && !isFetching && parcels.length > 1 && !listDismissed

  return (
    <div>
      <form onSubmit={handleSubmit} className="search-form">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 455 Siskiyou Blvd"
          aria-label="Ashland property address"
          className="search-input"
        />
        <button
          type="submit"
          disabled={isFetching || address.trim().length < 2}
          className="search-button"
        >
          {isFetching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '0.5rem' }}>
          <StatusBanner
            variant="error"
            message={error instanceof ApiError && error.errorCode === 'gis_unavailable'
              ? "Ashland's property data source is temporarily unavailable. Please try again shortly."
              : error instanceof ApiError && error.errorCode === 'network_error'
                ? error.detail
                : error.message}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {!isFetching && !error && searchAddress.length > 0 && parcels.length === 0 && suggestions.length === 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <StatusBanner
            variant="warning"
            message="We couldn't find that address in Ashland. This tool only covers properties within Ashland city limits."
          />
        </div>
      )}

      {!isFetching && !error && searchAddress.length > 0 && parcels.length === 0 && suggestions.length > 0 && (
        <div role="region" aria-labelledby="suggestions-heading" style={{ marginTop: '0.5rem' }}>
          <p id="suggestions-heading" className="search-results__hint">Did you mean…?</p>
          <ul className="search-results" aria-label="Suggested addresses">
            {suggestions.slice(0, 5).map((s) => (
              <li key={s.taxlot_id}>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="search-results__item"
                >
                  {s.address}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showResults && (
        <ul className="search-results">
          {parcels.slice(0, 5).map((parcel, i) => (
            <li key={parcel.taxlot_id ?? i}>
              <button
                type="button"
                onClick={() => handleSelect(parcel)}
                className="search-results__item"
              >
                {parcel.address} {parcel.acreage ? `(${parcel.acreage} ac)` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
