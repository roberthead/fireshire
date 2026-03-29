import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MapView } from './MapView'
import { MapProvider } from '../contexts/MapContext'

const mockRemove = vi.fn()
const mockAddControl = vi.fn()
const mockOn = vi.fn()
const constructorArgs: unknown[] = []

vi.mock('mapbox-gl', () => {
  class MockMap {
    remove = mockRemove
    addControl = mockAddControl
    on = mockOn
    constructor(opts: unknown) {
      constructorArgs.push(opts)
    }
  }

  class MockNavigationControl {}

  const mod = {
    default: {
      Map: MockMap,
      NavigationControl: MockNavigationControl,
      accessToken: '',
    },
    Map: MockMap,
    NavigationControl: MockNavigationControl,
  }
  return mod
})

vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))

function renderMapView() {
  return render(
    <MapProvider>
      <MapView />
    </MapProvider>
  )
}

describe('MapView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    constructorArgs.length = 0
    vi.stubEnv('VITE_MAPBOX_TOKEN', '')
  })

  it('shows error when VITE_MAPBOX_TOKEN is missing', () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '')
    renderMapView()
    expect(screen.getByTestId('map-error')).toBeInTheDocument()
    expect(screen.getByText(/mapbox token is missing/i)).toBeInTheDocument()
  })

  it('renders map container when token is provided', () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test_token_123')
    renderMapView()
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('initializes mapbox-gl Map with correct config', () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test_token_123')
    renderMapView()
    expect(constructorArgs).toHaveLength(1)
    expect(constructorArgs[0]).toMatchObject({
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-122.71, 42.19],
      zoom: 15,
    })
  })

  it('adds navigation control', () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test_token_123')
    renderMapView()
    expect(mockAddControl).toHaveBeenCalled()
  })

  it('calls map.remove() on unmount', () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test_token_123')
    const { unmount } = renderMapView()
    unmount()
    expect(mockRemove).toHaveBeenCalled()
  })
})
