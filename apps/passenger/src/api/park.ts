import type {
  DriverAcceptInvitePayload,
  ParkAnalytics,
  ParkDriversResponse,
  ParkInvite,
  ParkInvitesResponse,
  TaxiPark,
  TaxiParkRegisterPayload,
  TaxiParkUpdatePayload,
} from '~/types/park'
import { apiRequest } from '~/api/client'

export function registerPark(payload: TaxiParkRegisterPayload) {
  return apiRequest<TaxiPark>('/park/register', {
    method: 'POST',
    body: payload,
  })
}

export function getMyPark() {
  return apiRequest<TaxiPark>('/park/me')
}

export function updateMyPark(payload: TaxiParkUpdatePayload) {
  return apiRequest<TaxiPark>('/park/me', {
    method: 'PUT',
    body: payload,
  })
}

export function createParkInvite() {
  return apiRequest<ParkInvite>('/park/invites', {
    method: 'POST',
  })
}

export function listParkInvites() {
  return apiRequest<ParkInvitesResponse>('/park/invites')
}

export function listParkDrivers() {
  return apiRequest<ParkDriversResponse>('/park/drivers')
}

export function removeParkDriver(id: string) {
  return apiRequest<{ message: string }>(`/park/drivers/${id}`, {
    method: 'DELETE',
  })
}

export function getParkAnalytics() {
  return apiRequest<ParkAnalytics>('/park/analytics')
}

export function acceptParkInvite(payload: DriverAcceptInvitePayload) {
  return apiRequest<{ message: string }>('/driver/invite/accept', {
    method: 'POST',
    body: payload,
  })
}

export function listAvailableParks() {
  return apiRequest<{ parks: import('~/types/park').TaxiPark[] }>('/driver/parks')
}
