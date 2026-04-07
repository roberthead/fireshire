import { ApiError } from './api'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AllClearParcel {
  hash_code: string
  account: string
  role: string
  owner_name: string | null
  situs_address: string | null
  mailing_address: string | null
  acreage: number | null
  year_built: number | null
  city: string | null
  evac_zone: string | null
  subdivision: string | null
}

export interface Progress {
  hash_code: string
  survey_complete: boolean
  map_complete: boolean
}

export interface SurveyData {
  respondent_name: string
  respondent_email: string
  respondent_phone: string
  defensible_space: string
  ember_resistant_roof: string
  vegetation_clearance: string
  has_fire_plan: string
  has_go_bag: string
  water_source: string
  evacuation_route: string
  hoa_name: string
  wants_assessment: boolean
  wants_firewise: boolean
  wants_newsletter: boolean
  concerns: string
  notes: string
}

export interface SurveyResult {
  status: string
  survey_complete: boolean
  map_complete: boolean
  situs_address: string | null
}

export interface MapResultData {
  zones_geojson?: object
  buildings_count?: number
  plants_saved?: object
}

export interface MapSaveResult {
  status: string
  map_complete: boolean
  survey_complete: boolean
  situs_address: string | null
}

export interface HOA {
  hoa_name: string
  subdivision_name: string | null
  website: string | null
  phone: string | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, init)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new ApiError(res.status, body?.error ?? null, body?.detail ?? 'Server error')
    }
    return res.json()
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof TypeError) {
      throw new ApiError(0, 'network_error', "Can't reach the server. Please check your connection.")
    }
    throw err
  }
}

// ── API functions ───────────────────────────────────────────────────────────

export function searchParcels(address: string): Promise<AllClearParcel[]> {
  return fetchJson(`/api/allclear/parcels/search?address=${encodeURIComponent(address)}`)
}

export function getParcel(hashCode: string): Promise<AllClearParcel> {
  return fetchJson(`/api/allclear/parcels/${encodeURIComponent(hashCode)}`)
}

export function getProgress(hashCode: string): Promise<Progress> {
  return fetchJson(`/api/allclear/progress/${encodeURIComponent(hashCode)}`)
}

export function getLatestSurvey(hashCode: string): Promise<SurveyData | null> {
  return fetchJson(`/api/allclear/survey/${encodeURIComponent(hashCode)}`)
}

export function submitSurvey(hashCode: string, data: SurveyData): Promise<SurveyResult> {
  return fetchJson(`/api/allclear/survey/${encodeURIComponent(hashCode)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function saveMapResult(hashCode: string, data: MapResultData): Promise<MapSaveResult> {
  return fetchJson(`/api/allclear/map-result/${encodeURIComponent(hashCode)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function fetchHOAs(): Promise<HOA[]> {
  return fetchJson('/api/allclear/hoas')
}

export const INITIAL_SURVEY: SurveyData = {
  respondent_name: '',
  respondent_email: '',
  respondent_phone: '',
  defensible_space: '',
  ember_resistant_roof: '',
  vegetation_clearance: '',
  has_fire_plan: '',
  has_go_bag: '',
  water_source: '',
  evacuation_route: '',
  hoa_name: '',
  wants_assessment: false,
  wants_firewise: false,
  wants_newsletter: false,
  concerns: '',
  notes: '',
}
