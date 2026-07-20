import type {
  DailyChecksResponse,
  DailyCheckStatus,
  FacesResponse,
  VehiclesResponse,
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

export function listDailyChecks(params: { status?: DailyCheckStatus, limit?: number, offset?: number } = {}) {
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

// firstName/lastName — имя с удостоверения (TODO п.27): его увидит пассажир.
// Старый бэк лишние поля игнорирует — фронт можно деплоить раньше бэка.
export function reviewFaceChecklist(driverId: string, selfieOk: boolean, documentOk: boolean, reason = '', firstName = '', lastName = '') {
  return apiRequest<{ message: string }>(`/tech-support/verifications/faces/${driverId}/review`, {
    method: 'POST',
    body: { selfie_ok: selfieOk, document_ok: documentOk, reason, first_name: firstName, last_name: lastName },
  })
}
