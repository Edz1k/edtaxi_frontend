import type { CarRequestsResponse, SubmitCarRequestPayload } from '~/types/carRequest'
import { apiRequest } from '~/api/client'

export function submitCarRequest(payload: SubmitCarRequestPayload) {
  return apiRequest<{ id: string, status: string }>('/driver/car-requests', {
    body: payload,
    method: 'POST',
  })
}

export function listMyCarRequests() {
  return apiRequest<CarRequestsResponse>('/driver/car-requests')
}
