import type { DriverAcceptInvitePayload } from '~/types/park'
import { apiRequest } from '~/api/client'

export function acceptParkInvite(payload: DriverAcceptInvitePayload) {
  return apiRequest<{ message: string }>('/driver/invite/accept', {
    method: 'POST',
    body: payload,
  })
}
