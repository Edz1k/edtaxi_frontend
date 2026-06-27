import type { PassengerProfile, UpdatePassengerProfilePayload } from '~/types/passenger'
import { apiRequest } from '~/api/client'

export function getPassengerProfile() {
  return apiRequest<PassengerProfile>('/passenger/me')
}

export function updatePassengerProfile(payload: UpdatePassengerProfilePayload) {
  return apiRequest<PassengerProfile>('/passenger/me', {
    method: 'PUT',
    body: payload,
  })
}
