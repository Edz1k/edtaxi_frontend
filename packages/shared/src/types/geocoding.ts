export type RouteCoordinate = [number, number]

export interface GeoPlace {
  address: string
  // Расстояние от пользователя (точки А) до места в метрах — бэкенд считает
  // его для гео-саджеста; null, когда координаты пользователя неизвестны.
  distanceM?: null | number
  id: string
  // Место из «Избранных адресов» пассажира — бэк подмешивает их в начало
  // саджеста, фронт рисует звёздочку.
  isFavorite?: boolean
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
  distance_m?: null | number
  is_favorite?: boolean
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
