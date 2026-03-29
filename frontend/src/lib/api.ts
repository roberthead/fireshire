export interface Parcel {
  address: string
  taxlot_id: string | null
  acreage: number | null
  owner: string
  centroid: { lng: number; lat: number } | null
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
}

export interface ParcelResponse {
  parcels: Parcel[]
}

import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'

export type BuildingResponse = FeatureCollection<Polygon | MultiPolygon>

export async function fetchParcels(address: string): Promise<ParcelResponse> {
  const res = await fetch(`/api/parcels?address=${encodeURIComponent(address)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `Server error (${res.status})`)
  }
  return res.json()
}

export async function fetchBuildings(bbox: {
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}): Promise<BuildingResponse> {
  const params = new URLSearchParams({
    xmin: String(bbox.xmin),
    ymin: String(bbox.ymin),
    xmax: String(bbox.xmax),
    ymax: String(bbox.ymax),
  })
  const res = await fetch(`/api/buildings?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `Server error (${res.status})`)
  }
  return res.json()
}
