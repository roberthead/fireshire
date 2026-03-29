import { useEffect } from 'react'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { useMapContext } from '../hooks/useMapContext'
import { computeZoneRings } from '../lib/computeZoneRings'
import type { BuildingResponse } from '../lib/api'

const ZONE_STYLES = [
  { id: 'zone4', color: '#48bb78', opacity: 0.25 },
  { id: 'zone3', color: '#ecc94b', opacity: 0.25 },
  { id: 'zone2', color: '#ed8936', opacity: 0.35 },
  { id: 'zone1', color: '#e53e3e', opacity: 0.35 },
] as const

const LAYER_IDS = [...ZONE_STYLES.map((z) => `${z.id}-fill`), ...ZONE_STYLES.map((z) => `${z.id}-line`), 'buildings-fill', 'buildings-outline']
const SOURCE_IDS = [...ZONE_STYLES.map((z) => z.id), 'buildings']

function cleanupLayers(map: mapboxgl.Map) {
  for (const id of LAYER_IDS) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  for (const id of SOURCE_IDS) {
    if (map.getSource(id)) map.removeSource(id)
  }
}

export function ZoneOverlay({ buildings }: { buildings: BuildingResponse }) {
  const { map, zoneVisibility, setZonesReady } = useMapContext()

  useEffect(() => {
    if (!map || !buildings) return

    try {
      cleanupLayers(map)

      const zones = computeZoneRings(buildings as FeatureCollection<Polygon | MultiPolygon>)

      const zoneData = {
        zone4: zones.zone4,
        zone3: zones.zone3,
        zone2: zones.zone2,
        zone1: zones.zone1,
      }

      for (const style of ZONE_STYLES) {
        const data = zoneData[style.id as keyof typeof zoneData]
        if (!map.getSource(style.id)) {
          map.addSource(style.id, { type: 'geojson', data })
        }
        if (!map.getLayer(`${style.id}-fill`)) {
          map.addLayer({
            id: `${style.id}-fill`,
            type: 'fill',
            source: style.id,
            paint: { 'fill-color': style.color, 'fill-opacity': style.opacity },
          })
        }
        if (!map.getLayer(`${style.id}-line`)) {
          map.addLayer({
            id: `${style.id}-line`,
            type: 'line',
            source: style.id,
            paint: { 'line-color': style.color, 'line-width': 2, 'line-opacity': 0.8 },
          })
        }
      }

      if (!map.getSource('buildings')) {
        map.addSource('buildings', { type: 'geojson', data: buildings })
      }
      if (!map.getLayer('buildings-fill')) {
        map.addLayer({
          id: 'buildings-fill',
          type: 'fill',
          source: 'buildings',
          paint: { 'fill-color': '#334155', 'fill-opacity': 0.6 },
        })
      }
      if (!map.getLayer('buildings-outline')) {
        map.addLayer({
          id: 'buildings-outline',
          type: 'line',
          source: 'buildings',
          paint: { 'line-color': '#ffffff', 'line-width': 1.5 },
        })
      }

      setZonesReady(true)
    } catch {
      // Mapbox style may be transiently unavailable — safe to skip
    }

    return () => {
      setZonesReady(false)
      try {
        if (map) cleanupLayers(map)
      } catch {
        // Style may not be loaded during teardown
      }
    }
  }, [map, buildings, setZonesReady])

  // Sync layer visibility with toggle state
  useEffect(() => {
    if (!map) return
    try {
      for (const style of ZONE_STYLES) {
        const visible = zoneVisibility[style.id] ? 'visible' : 'none'
        if (map.getLayer(`${style.id}-fill`)) {
          map.setLayoutProperty(`${style.id}-fill`, 'visibility', visible)
        }
        if (map.getLayer(`${style.id}-line`)) {
          map.setLayoutProperty(`${style.id}-line`, 'visibility', visible)
        }
      }
    } catch {
      // Mapbox style may be transiently unavailable
    }
  }, [map, zoneVisibility])

  return null
}
