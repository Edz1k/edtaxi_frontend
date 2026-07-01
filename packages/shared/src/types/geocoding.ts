export type RouteCoordinate = [number, number]

export interface GeoPlace {
  address: string
  id: string
  lat: number
  lng: number
  name: string
  subtitle?: string
}

export interface GeocodingSuggestPayload {
  lat?: number
  lng?: number
  query: string
}

export interface GeocodingSuggestion {
  lat: number
  lng: number
  subtitle: string
  title: string
}

export type GeocodingSuggestResponse = GeocodingSuggestion[] | {
  results: GeocodingSuggestion[]
}

export interface ReverseGeocodePayload {
  lat: number
  lng: number
}

export interface ReverseGeocodeResponse {
  address: string
  lat: number
  lng: number
}

export interface RoutePayload {
  from_lat: number
  from_lng: number
  to_lat: number
  to_lng: number
}

export interface RouteResponse {
  coordinates: RouteCoordinate[]
  distance_km: number
  duration_min: number
}

export interface TripRoute {
  distance_km: number
  duration_min: number
  geometry: RouteCoordinate[]
}
