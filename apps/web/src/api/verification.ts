import type {
  DailyChecksResponse,
  FacesResponse,
  VehiclesResponse,
  VerificationStatus,
} from '~/types/verification'
import { apiRequest } from '~/api/client'

export function listPendingFaces(params: { limit?: number, offset?: number } = {}) {
  return apiRequest<FacesResponse>('/tech-support/verifications/faces', { params })
}

// reviewFace принимает driver_id (не vehicle id — верификация лица одна на водителя).
export function reviewFace(driverId: string, approve: boolean) {
  return apiRequest<{ message: string }>(`/tech-support/verifications/faces/${driverId}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
  })
}

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

// --- Решение по чек-листу (пер-блочные вердикты, как «Фотоконтроль» в Я.Про).
// Итог approved только когда все блоки ок; при отказе причина обязательна.

export function reviewVehicleChecklist(id: string, photosOk: boolean, docsOk: boolean, reason = '') {
  return apiRequest<{ message: string }>(`/tech-support/verifications/vehicles/${id}/review`, {
    method: 'POST',
    body: { photos_ok: photosOk, docs_ok: docsOk, reason },
  })
}

export function reviewDailyCheckChecklist(id: string, selfieOk: boolean, vehicleOk: boolean, reason = '') {
  return apiRequest<{ message: string }>(`/tech-support/verifications/daily-checks/${id}/review`, {
    method: 'POST',
    body: { selfie_ok: selfieOk, vehicle_ok: vehicleOk, reason },
  })
}

export function reviewFaceChecklist(driverId: string, selfieOk: boolean, documentOk: boolean, reason = '') {
  return apiRequest<{ message: string }>(`/tech-support/verifications/faces/${driverId}/review`, {
    method: 'POST',
    body: { selfie_ok: selfieOk, document_ok: documentOk, reason },
  })
}
