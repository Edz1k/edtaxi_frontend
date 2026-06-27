import type {
  DailyChecksResponse,
  VehiclesResponse,
  VerificationStatus,
} from '~/types/verification'
import { apiRequest } from '~/api/client'

export function listPendingVehicles(params: { limit?: number, offset?: number } = {}) {
  return apiRequest<VehiclesResponse>('/tech-support/verifications/vehicles', { params })
}

export function reviewVehicle(id: string, approve: boolean) {
  return apiRequest<{ message: string }>(`/tech-support/verifications/vehicles/${id}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
  })
}

export function listDailyChecks(params: { status?: VerificationStatus, limit?: number, offset?: number } = {}) {
  return apiRequest<DailyChecksResponse>('/tech-support/verifications/daily-checks', { params })
}

export function reviewDailyCheck(id: string, approve: boolean, reason = '') {
  return apiRequest<{ message: string }>(`/tech-support/verifications/daily-checks/${id}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
    body: approve ? undefined : { reason },
  })
}
