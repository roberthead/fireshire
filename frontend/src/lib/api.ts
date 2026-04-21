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

// --- Plant Entries API types ---

export type ZoneKey = '0-5' | '5-10' | '10-30' | '30-100'

export interface PlantEntry {
  id: string
  taxlot_id: string
  zone: ZoneKey
  plant_id: string | null
  plant_name: string
  source: 'manual' | 'photo_id'
  image_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PlantEntriesResponse {
  entries: PlantEntry[]
}

export interface PlantEntryCreate {
  taxlot_id: string
  zone: ZoneKey
  plant_id?: string | null
  plant_name: string
  notes?: string | null
}

export interface PlantEntryUpdate {
  zone?: ZoneKey
  plant_name?: string
  notes?: string | null
}

async function handleJsonResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error ?? null, body?.detail ?? 'Server error')
  }
  return res.json()
}

export async function fetchEntries(taxlotId: string): Promise<PlantEntriesResponse> {
  try {
    const res = await fetch(
      `/api/plant-entries?taxlot_id=${encodeURIComponent(taxlotId)}`,
    )
    return handleJsonResponse<PlantEntriesResponse>(res)
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof TypeError) {
      throw new ApiError(0, 'network_error', "We can't reach our server right now. Please check your connection and try again.")
    }
    throw err
  }
}

export async function createEntry(data: PlantEntryCreate): Promise<PlantEntry> {
  try {
    const res = await fetch('/api/plant-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleJsonResponse<PlantEntry>(res)
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof TypeError) {
      throw new ApiError(0, 'network_error', "We can't reach our server right now. Please check your connection and try again.")
    }
    throw err
  }
}

export async function updateEntry(
  id: string,
  data: PlantEntryUpdate,
): Promise<PlantEntry> {
  try {
    const res = await fetch(`/api/plant-entries/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleJsonResponse<PlantEntry>(res)
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof TypeError) {
      throw new ApiError(0, 'network_error', "We can't reach our server right now. Please check your connection and try again.")
    }
    throw err
  }
}

export async function deleteEntry(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/plant-entries/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => null)
      throw new ApiError(res.status, body?.error ?? null, body?.detail ?? 'Server error')
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof TypeError) {
      throw new ApiError(0, 'network_error', "We can't reach our server right now. Please check your connection and try again.")
    }
    throw err
  }
}
