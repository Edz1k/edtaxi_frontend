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
