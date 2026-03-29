import { useState, useMemo, useEffect, useRef, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchParcels, type Parcel } from '../lib/api'
import { useMapContext } from '../hooks/useMapContext'

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
  onParcelSelected,
}: {
  onParcelSelected?: (parcel: Parcel) => void
}) {
  const [address, setAddress] = useState('')
  const [searchAddress, setSearchAddress] = useState('')
  const { map } = useMapContext()
  const autoSelectedRef = useRef('')

  const { data, isFetching, error } = useQuery({
    queryKey: ['parcels', searchAddress],
    queryFn: () => fetchParcels(searchAddress),
    enabled: searchAddress.length > 0,
  })

  const parcels = useMemo(() => data?.parcels ?? [], [data])

  // Auto-select single result
  useEffect(() => {
    if (parcels.length === 1 && !isFetching && map) {
      const parcel = parcels[0]
      const key = `${searchAddress}:${parcel.taxlot_id}`
      if (autoSelectedRef.current !== key) {
        autoSelectedRef.current = key
        showParcelOnMap(map, parcel)
        onParcelSelected?.(parcel)
      }
    }
  }, [parcels, isFetching, map, searchAddress, onParcelSelected])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (address.trim().length < 2) return
    autoSelectedRef.current = ''
    setSearchAddress(address.trim())
  }

  function handleSelect(parcel: Parcel) {
    if (map) showParcelOnMap(map, parcel)
    onParcelSelected?.(parcel)
  }

  const showResults = searchAddress.length > 0 && !isFetching && parcels.length > 1

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 455 Siskiyou Blvd"
          aria-label="Ashland property address"
          style={{ padding: '0.5rem', width: '300px' }}
        />
        <button
          type="submit"
          disabled={isFetching || address.trim().length < 2}
          style={{ padding: '0.5rem 1rem' }}
        >
          {isFetching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div role="alert" style={{ color: '#991b1b', background: '#fef2f2', padding: '0.5rem', marginTop: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
          {error.message}
        </div>
      )}

      {!isFetching && searchAddress.length > 0 && parcels.length === 0 && (
        <div role="alert" style={{ background: '#fffbeb', padding: '0.5rem', marginTop: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
          No parcels found for that address. Try a different Ashland address.
        </div>
      )}

      {showResults && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', background: '#fff', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', maxHeight: '200px', overflow: 'auto' }}>
          {parcels.slice(0, 5).map((parcel, i) => (
            <li key={parcel.taxlot_id ?? i}>
              <button
                type="button"
                onClick={() => handleSelect(parcel)}
                style={{ width: '100%', textAlign: 'left', padding: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #eee' }}
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
