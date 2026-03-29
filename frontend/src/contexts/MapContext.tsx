import { createContext, useState, useCallback, type ReactNode } from 'react'
import type { Map } from 'mapbox-gl'

export interface MapContextValue {
  map: Map | null
  setMap: (map: Map | null) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const MapContext = createContext<MapContextValue | null>(null)

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMapState] = useState<Map | null>(null)

  const setMap = useCallback((m: Map | null) => {
    setMapState(m)
  }, [])

  return (
    <MapContext.Provider value={{ map, setMap }}>
      {children}
    </MapContext.Provider>
  )
}
