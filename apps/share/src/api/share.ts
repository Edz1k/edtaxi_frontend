import type { PublicTripShareResponse, TripShareResponse } from '~/types/share'
import { apiRequest } from '~/api/client'

export function shareTripLink(tripId: string) {
  return apiRequest<TripShareResponse>(`/trips/${tripId}/share`, {
    method: 'POST',
  })
}

export function getSharedTrip(token: string) {
  return apiRequest<PublicTripShareResponse>(`/share/${token}`, {
    skipAuthRefresh: true,
  })
}

// Геометрия маршрута A→B по share-токену: публичная (штатный POST /route
// требует авторизацию, а страница анонимна). Формат координат — [lng, lat].
export interface SharedTripRouteResponse {
  coordinates: [number, number][]
  distance_m: number
  duration_sec: number
}

export function getSharedTripRoute(token: string) {
  return apiRequest<SharedTripRouteResponse>(`/share/${token}/route`, {
    skipAuthRefresh: true,
  })
}
