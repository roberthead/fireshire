import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useMapContext } from '../hooks/useMapContext'

const ASHLAND_CENTER: [number, number] = [-122.71, 42.19]
const DEFAULT_ZOOM = 15

export function MapView({ ariaLabel }: { ariaLabel?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const { setMap } = useMapContext()
  const [error, setError] = useState<string | null>(null)

  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  const tokenMissing = !token

  useEffect(() => {
    if (tokenMissing || !containerRef.current) return

    mapboxgl.accessToken = token

    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: ASHLAND_CENTER,
        zoom: DEFAULT_ZOOM,
      })

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')

      map.on('error', (e) => {
        const err = e.error as unknown as Record<string, unknown> | undefined
        if (err?.status === 401 || (typeof err?.message === 'string' && err.message.includes('access token'))) {
          setError('Invalid Mapbox token. Please check your VITE_MAPBOX_TOKEN.')
        }
      })

      map.on('load', () => {
        mapRef.current = map
        setMap(map)
      })

      return () => {
        setMap(null)
        mapRef.current = null
        map.remove()
      }
    } catch (e) {
      const message = `Failed to initialize map: ${e instanceof Error ? e.message : String(e)}`
      queueMicrotask(() => setError(message))
    }
  }, [token, tokenMissing, setMap])

  const displayError = tokenMissing
    ? 'Mapbox token is missing. Please set VITE_MAPBOX_TOKEN in your .env file.'
    : error

  if (displayError) {
    return (
      <div
        data-testid="map-error"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fef2f2',
          color: '#991b1b',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div>
          <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Map Error</p>
          <p>{displayError}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      data-testid="map-container"
      role="img"
      aria-label={ariaLabel ?? 'Satellite map of Ashland, Oregon'}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
