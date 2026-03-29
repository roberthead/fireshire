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

export class ApiError extends Error {
  status: number
  errorCode: string | null
  detail: string

  constructor(status: number, errorCode: string | null, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
    this.detail = detail
  }
}

export async function fetchParcels(address: string): Promise<ParcelResponse> {
  try {
    const res = await fetch(`/api/parcels?address=${encodeURIComponent(address)}`)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new ApiError(res.status, body?.error ?? null, body?.detail ?? 'Server error')
    }
    return res.json()
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof TypeError) {
      throw new ApiError(0, 'network_error', "We can't reach our server right now. Please check your connection and try again.")
    }
    throw err
  }
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
  try {
    const res = await fetch(`/api/buildings?${params}`)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new ApiError(res.status, body?.error ?? null, body?.detail ?? 'Server error')
    }
    return res.json()
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof TypeError) {
      throw new ApiError(0, 'network_error', "We can't reach our server right now. Please check your connection and try again.")
    }
    throw err
  }
}

// --- Plants API types ---

export interface PlantImage {
  id: string
  url: string
  caption: string | null
}

export interface PlantValue {
  attributeId: string
  attributeName: string
  rawValue: string
  resolved: { value: string; type: string; id: string }
}

export interface Plant {
  id: string
  genus: string
  species: string
  commonName: string
  primaryImage: PlantImage | null
  values: PlantValue[]
}

export interface PlantResponse {
  data: Plant[]
  meta: {
    pagination: { total: number; limit: number; offset: number; hasMore: boolean }
  }
}

export async function fetchPlants(
  zones: string[],
  search?: string,
): Promise<PlantResponse> {
  const params = new URLSearchParams({
    zones: zones.join(','),
  })
  if (search) {
    params.set('search', search)
  }
  try {
    const res = await fetch(`/api/plants?${params}`)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new ApiError(
        res.status,
        body?.error ?? null,
        body?.detail ?? 'Server error',
      )
    }
    return res.json()
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof TypeError) {
      throw new ApiError(
        0,
        'network_error',
        "We can't reach our server right now. Please check your connection and try again.",
      )
    }
    throw err
  }
}
