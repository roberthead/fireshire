import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { AddressSearch } from '../components/AddressSearch'
import { ZoneLegend } from '../components/ZoneLegend'
import { ZoneSummary } from '../components/ZoneSummary'
import { MapView } from '../components/MapView'
import { MapProvider } from '../contexts/MapContext'
import { ZoneOverlay } from '../components/ZoneOverlay'
import { computeZoneRings } from '../lib/computeZoneRings'
import { fetchBuildings, ApiError, type Parcel } from '../lib/api'
import { StatusBanner } from '../components/StatusBanner'

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

function HomePage() {
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null)

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
      <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 1 }}>
        <AddressSearch onParcelSelected={setSelectedParcel} />
      </div>
      {buildingsFetching && selectedParcel && (
        <div style={{ position: 'absolute', top: '4.5rem', left: '1rem', zIndex: 1 }}>
          <StatusBanner variant="loading" message="Drawing fire zones..." />
        </div>
      )}
      {buildingsError && selectedParcel && (
        <div style={{ position: 'absolute', top: '4.5rem', left: '1rem', zIndex: 1 }}>
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
        <div style={{ position: 'absolute', top: '4.5rem', left: '1rem', zIndex: 1 }}>
          <StatusBanner
            variant="info"
            message="We found your parcel but no building footprints. Zones are drawn around structures."
          />
        </div>
      )}
      <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', zIndex: 1 }}>
        <ZoneLegend />
      </div>
      {selectedParcel && zones && hasBuildings && (
        <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', zIndex: 1 }}>
          <ZoneSummary
            address={selectedParcel.address}
            buildingCount={buildings.features.length}
            zones={zones}
          />
        </div>
      )}
      <MapView ariaLabel={mapAriaLabel} />
      {hasBuildings && (
        <ZoneOverlay buildings={buildings} />
      )}
    </MapProvider>
  )
}
