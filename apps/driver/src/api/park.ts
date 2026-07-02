import type { AvailableParksResponse, DriverAcceptInvitePayload } from '~/types/park'
import { apiRequest } from '~/api/client'

export function acceptParkInvite(payload: DriverAcceptInvitePayload) {
  return apiRequest<{ message: string }>('/driver/invite/accept', {
    method: 'POST',
    body: payload,
  })
}

// listAvailableParks — список парков, к которым водитель может присоединиться.
export function listAvailableParks(params: { limit?: number, offset?: number } = {}) {
  return apiRequest<AvailableParksResponse>('/driver/parks', { params })
}
