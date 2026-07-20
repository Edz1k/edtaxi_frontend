import type { ApproveCarRequestPayload, CarRequestsListResponse } from '~/types/carRequest'
import { apiRequest } from '~/api/client'

export function listCarRequests(params: { limit?: number, offset?: number, status?: string } = {}) {
  const query: Record<string, number | string> = {}
  if (params.status)
    query.status = params.status
  if (params.limit != null)
    query.limit = params.limit
  if (params.offset != null)
    query.offset = params.offset

  return apiRequest<CarRequestsListResponse>('/tech-support/car-requests', { params: query })
}

export function approveCarRequest(id: string, entry: ApproveCarRequestPayload) {
  return apiRequest<{ message: string, status: string, catalog_entry_id: string }>(
    `/tech-support/car-requests/${id}/approve`,
    { method: 'POST', body: entry },
  )
}

export function rejectCarRequest(id: string, reason: string) {
  return apiRequest<{ message: string }>(`/tech-support/car-requests/${id}/reject`, {
    method: 'POST',
    body: { reason },
  })
}
