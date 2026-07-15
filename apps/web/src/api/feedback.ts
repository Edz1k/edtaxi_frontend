import type { FeedbackListResponse } from '~/types/feedback'
import { apiRequest } from '~/api/client'

export function listAdminFeedback(params: { limit?: number, offset?: number, status?: string } = {}) {
  const query: Record<string, number | string> = {}
  if (params.status)
    query.status = params.status
  if (params.limit != null)
    query.limit = params.limit
  if (params.offset != null)
    query.offset = params.offset

  return apiRequest<FeedbackListResponse>('/admin/feedback', { params: query })
}

// implementAdminFeedback — «Внедрено» + опциональная награда (0 — без начисления).
export function implementAdminFeedback(id: string, reward: number) {
  return apiRequest<{ message: string, reward_sent: boolean, status: string }>(`/admin/feedback/${id}/implement`, {
    method: 'POST',
    body: { reward },
  })
}

export function rejectAdminFeedback(id: string) {
  return apiRequest<{ message: string }>(`/admin/feedback/${id}/reject`, {
    method: 'POST',
  })
}
