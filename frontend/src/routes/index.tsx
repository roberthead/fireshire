import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { AddressSearch } from '../components/AddressSearch'
import { ZoneLegend } from '../components/ZoneLegend'
import { ZoneSummary } from '../components/ZoneSummary'
import { PlantPanel } from '../components/PlantPanel'
import { MapView } from '../components/MapView'
import { MapProvider } from '../contexts/MapContext'
import { ZoneOverlay } from '../components/ZoneOverlay'
import { computeZoneRings } from '../lib/computeZoneRings'
import { fetchBuildings, ApiError, type Parcel } from '../lib/api'
import { StatusBanner } from '../components/StatusBanner'
import { useMapContext } from '../hooks/useMapContext'
import { activeZoneDisplayNames } from '../lib/zoneDisplayNames'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function bboxFromGeometry(geometry: Parcel['geometry']) {
  const coords = geometry.coordinates[0]
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity
  for (const [lng, lat] of coords) {
    if (lng < xmin) xmin = lng
    if (lat < ymin) ymin = lat
    if (lng > xmax) xmax = lng
    if (lat > ymax) ymax = lat
  }
  return { xmin, ymin, xmax, ymax }
}

function PlantPanelConnector({ address, onClose }: { address?: string; onClose: () => void }) {
  const { zoneVisibility } = useMapContext()
  const zones = activeZoneDisplayNames(zoneVisibility)
  if (zones.length === 0) return null
  return <PlantPanel address={address} zones={zones} onClose={onClose} />
}

function HomePage() {
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null)
  const [plantPanelOpen, setPlantPanelOpen] = useState(true)

  const bbox = selectedParcel ? bboxFromGeometry(selectedParcel.geometry) : null

  const { data: buildings, isFetching: buildingsFetching, error: buildingsError, refetch: refetchBuildings } = useQuery({
    queryKey: ['buildings', bbox],
    queryFn: () => fetchBuildings(bbox!),
    enabled: bbox !== null,
  })

  const hasBuildings = buildings && buildings.features.length > 0

  const zones = useMemo(() => {
    if (!hasBuildings) return null
    return computeZoneRings(buildings as FeatureCollection<Polygon | MultiPolygon>)
  }, [buildings, hasBuildings])

  const mapAriaLabel = selectedParcel && hasBuildings
    ? `Satellite map of ${selectedParcel.address} showing ${buildings.features.length} building${buildings.features.length === 1 ? '' : 's'} with 4 fire-resilient landscaping zones`
    : undefined

  return (
    <MapProvider>
      <div className="overlay-top-left">
        <AddressSearch onParcelSelected={(parcel) => { setSelectedParcel(parcel); setPlantPanelOpen(true) }} />
      </div>
      {buildingsFetching && selectedParcel && (
        <div className="overlay-below-search">
          <StatusBanner variant="loading" message="Drawing fire zones..." />
        </div>
      )}
      {buildingsError && selectedParcel && (
        <div className="overlay-below-search">
          <StatusBanner
            variant="error"
            message={buildingsError instanceof ApiError && buildingsError.errorCode === 'gis_unavailable'
              ? "Ashland's building data source is temporarily unavailable."
              : buildingsError.message}
            onRetry={() => refetchBuildings()}
          />
        </div>
      )}
      {selectedParcel && buildings && buildings.features.length === 0 && !buildingsFetching && (
        <div className="overlay-below-search">
          <StatusBanner
            variant="info"
            message="We found your parcel but no building footprints. Zones are drawn around structures."
          />
        </div>
      )}
      <div className="overlay-bottom-right">
        <ZoneLegend />
      </div>
      {selectedParcel && zones && hasBuildings && (
        <div className="overlay-bottom-left">
          <ZoneSummary
            address={selectedParcel.address}
            buildingCount={buildings.features.length}
            zones={zones}
          />
        </div>
      )}
      {selectedParcel && hasBuildings && plantPanelOpen && (
        <div className="overlay-right">
          <PlantPanelConnector address={selectedParcel?.address} onClose={() => setPlantPanelOpen(false)} />
        </div>
      )}
      <MapView ariaLabel={mapAriaLabel} />
      {hasBuildings && (
        <ZoneOverlay buildings={buildings} />
      )}
    </MapProvider>
  )
}
