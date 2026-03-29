import { useContext } from 'react'
import { MapContext } from '../contexts/MapContext'
import type { MapContextValue } from '../contexts/MapContext'

export function useMapContext(): MapContextValue {
  const context = useContext(MapContext)
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider')
  }
  return context
}
