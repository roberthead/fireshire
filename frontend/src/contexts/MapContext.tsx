import { createContext, useState, useCallback, type ReactNode } from 'react'
import type { Map } from 'mapbox-gl'

export interface MapContextValue {
  map: Map | null
  setMap: (map: Map | null) => void
  zoneVisibility: Record<string, boolean>
  toggleZoneVisibility: (zoneId: string) => void
  zonesReady: boolean
  setZonesReady: (ready: boolean) => void
}

const DEFAULT_VISIBILITY: Record<string, boolean> = {
  zone1: true,
  zone2: true,
  zone3: true,
  zone4: true,
}

// eslint-disable-next-line react-refresh/only-export-components
export const MapContext = createContext<MapContextValue | null>(null)

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMapState] = useState<Map | null>(null)
  const [zoneVisibility, setZoneVisibility] = useState(DEFAULT_VISIBILITY)
  const [zonesReady, setZonesReady] = useState(false)

  const setMap = useCallback((m: Map | null) => {
    setMapState(m)
  }, [])

  const toggleZoneVisibility = useCallback((zoneId: string) => {
    setZoneVisibility((prev) => ({ ...prev, [zoneId]: !prev[zoneId] }))
  }, [])

  return (
    <MapContext.Provider
      value={{ map, setMap, zoneVisibility, toggleZoneVisibility, zonesReady, setZonesReady }}
    >
      {children}
    </MapContext.Provider>
  )
}
