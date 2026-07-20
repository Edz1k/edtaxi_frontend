import type {
  GeocodingSuggestion,
  GeocodingSuggestPayload,
  GeocodingSuggestResponse,
  GeoPlace,
  ReverseGeocodePayload,
  ReverseGeocodeResponse,
  RoutePayload,
  RoutePoint,
  RoutePointsPayload,
  RouteResponse,
  TripRoute,
} from '../types/geocoding'
import { apiRequest } from './client'

function getSuggestResults(response: GeocodingSuggestResponse) {
  return Array.isArray(response) ? response : response.results
}

function isDegraded(response: GeocodingSuggestResponse) {
  return Array.isArray(response) ? false : Boolean(response.degraded)
}

function suggestionToPlace(suggestion: GeocodingSuggestion, index: number): GeoPlace {
  return {
    address: [suggestion.title, suggestion.subtitle].filter(Boolean).join(', '),
    distanceM: suggestion.distance_m ?? null,
    id: `${suggestion.lat}:${suggestion.lng}:${index}`,
    isFavorite: suggestion.is_favorite ?? false,
    lat: suggestion.lat,
    lng: suggestion.lng,
    name: suggestion.title,
    subtitle: suggestion.subtitle,
  }
}

function reverseGeocodeToPlace(response: ReverseGeocodeResponse): GeoPlace {
  return {
    address: response.address,
    id: `${response.lat}:${response.lng}`,
    lat: response.lat,
    lng: response.lng,
    name: response.address,
  }
}

export function suggestAddresses(payload: GeocodingSuggestPayload) {
  return apiRequest<GeocodingSuggestResponse>('/geocoding/suggest', {
    method: 'POST',
    body: payload,
  })
}

export function reverseGeocode(payload: ReverseGeocodePayload) {
  return apiRequest<ReverseGeocodeResponse>('/geocoding/reverse', {
    method: 'POST',
    body: payload,
  })
}

export function getRoute(payload: RoutePayload | RoutePointsPayload) {
  return apiRequest<RouteResponse>('/route', {
    method: 'POST',
    body: payload,
  })
}

// near — координаты пользователя (обычно точка А): с ними бэкенд ищет сначала
// в городе пользователя, затем в остальных, и проставляет расстояния до
// подсказок (distance_m). Без near — как раньше, без гео-приоритета.
//
// Возвращает { places, degraded }: degraded=true — геокодер недоступен, в places
// только избранные (или пусто). Вызывающий показывает подсказку и не трактует
// пустой список как «адрес не найден».
export async function searchPlaces(query: string, near?: { lat: number, lng: number } | null): Promise<{ degraded: boolean, places: GeoPlace[] }> {
  const trimmedQuery = query.trim()

  if (trimmedQuery.length < 3)
    return { degraded: false, places: [] }

  const response = await suggestAddresses({
    query: trimmedQuery,
    lat: near?.lat,
    lng: near?.lng,
  })

  return {
    degraded: isDegraded(response),
    places: getSuggestResults(response).map(suggestionToPlace),
  }
}

export async function reverseGeocodePlace(lng: number, lat: number) {
  const response = await reverseGeocode({ lat, lng })

  return reverseGeocodeToPlace(response)
}

export async function getDrivingRoute(from: GeoPlace, to: GeoPlace): Promise<TripRoute> {
  const route = await getRoute({
    from_lat: from.lat,
    from_lng: from.lng,
    to_lat: to.lat,
    to_lng: to.lng,
  })

  return {
    distance_km: route.distance_km,
    duration_min: route.duration_min,
    geometry: route.coordinates,
    snapped_pickup: route.snapped_pickup,
  }
}

// Маршрут через несколько точек (A → остановки → B, до 5 точек): суммарные
// distance/duration и склеенная геометрия приходят одним вызовом.
export async function getDrivingRouteVia(points: RoutePoint[]): Promise<TripRoute> {
  const route = await getRoute({
    points: points.map(point => ({ lat: point.lat, lng: point.lng })),
  })

  return {
    distance_km: route.distance_km,
    duration_min: route.duration_min,
    geometry: route.coordinates,
    snapped_pickup: route.snapped_pickup,
  }
}
