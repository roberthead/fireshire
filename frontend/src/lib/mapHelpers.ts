import type { Parcel } from './api'

export function showParcelOnMap(map: mapboxgl.Map, parcel: Parcel) {
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
