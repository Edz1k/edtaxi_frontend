import type {
  DailyCheck,
  DriverEarnings,
  DriverLocationPayload,
  DriverProfile,
  DriverStatusPayload,
  DriverStatusResponse,
  DriverTripActionResponse,
  DriverVehicle,
  DriverVehiclePayload,
  DriverVehicleVerification,
  DriverVerificationsResponse,
  DriverWallet,
  DriverWalletTopUpPayload,
  DriverWalletTopUpResponse,
} from '~/types/driver'
import type { DriverOverview } from '~/types/driver-overview'
import type { ActiveTripResponse, Trip } from '~/types/trips'
import { apiRequest } from '~/api/client'
import { acceptParkInvite } from '~/api/park'

export function getDriverProfile() {
  return apiRequest<DriverProfile>('/driver/profile')
}

// getDriverOverview — личный кабинет водителя о себе: анкета, машины, рейтинг
// и история его снижения.
export function getDriverOverview() {
  return apiRequest<DriverOverview>('/driver/overview')
}

export function createDriverProfile() {
  return apiRequest<DriverProfile>('/driver/profile', {
    method: 'POST',
  })
}

export function addDriverVehicle(payload: DriverVehiclePayload) {
  return apiRequest<DriverVehicle>('/driver/vehicles', {
    method: 'POST',
    body: payload,
  })
}

export function updateDriverVehicle(id: string, payload: DriverVehiclePayload) {
  return apiRequest<DriverVehicleVerification>(`/driver/vehicles/${id}`, {
    method: 'PUT',
    body: payload,
  })
}

export function updateDriverStatus(payload: DriverStatusPayload) {
  return apiRequest<DriverStatusResponse>('/driver/status', {
    method: 'POST',
    body: payload,
  })
}

export function updateDriverLocation(payload: DriverLocationPayload) {
  return apiRequest<{ message: string }>('/driver/location', {
    method: 'POST',
    body: {
      lat: payload.lat,
      lng: payload.lng,
    },
  })
}

export function acceptDriverTrip(id: string) {
  return apiRequest<DriverTripActionResponse>(`/driver/trips/${id}/accept`, {
    method: 'POST',
  })
}

export function rejectDriverTrip(id: string) {
  return apiRequest<DriverTripActionResponse>(`/driver/trips/${id}/reject`, {
    method: 'POST',
  })
}

export function markDriverArrived(id: string) {
  return apiRequest<DriverTripActionResponse>(`/driver/trips/${id}/arrived`, {
    method: 'POST',
  })
}

export function startDriverTrip(id: string) {
  return apiRequest<DriverTripActionResponse>(`/driver/trips/${id}/start`, {
    method: 'POST',
  })
}

export function completeDriverTrip(id: string) {
  return apiRequest<DriverTripActionResponse>(`/driver/trips/${id}/complete`, {
    method: 'POST',
  })
}

export function cancelDriverTrip(id: string) {
  return apiRequest<DriverTripActionResponse>(`/driver/trips/${id}/cancel`, {
    method: 'POST',
  })
}

export async function getActiveDriverTrip(): Promise<null | Trip> {
  const response = await apiRequest<ActiveTripResponse>('/driver/trips/active')
  return response.trip
}

export function getDriverEarnings() {
  return apiRequest<DriverEarnings>('/driver/earnings')
}

export function getDriverWallet() {
  return apiRequest<DriverWallet>('/driver/wallet')
}

export function topUpDriverWallet(payload: DriverWalletTopUpPayload) {
  return apiRequest<DriverWalletTopUpResponse>('/driver/wallet/topup', {
    method: 'POST',
    body: payload,
  })
}

export function acceptDriverParkInvite(token: string) {
  return acceptParkInvite({ token })
}

export function getVerificationStatus() {
  return apiRequest<DriverVerificationsResponse>('/driver/verifications')
}

export function listDriverVehicles() {
  return apiRequest<{ vehicles: DriverVehicleVerification[] }>('/driver/vehicles')
}

export function uploadVehiclePhoto(vehicleId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<DriverVehicleVerification>(`/driver/vehicles/${vehicleId}/photo`, {
    method: 'POST',
    body: form,
  })
}

export function uploadVehicleTechPassport(vehicleId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<{ message: string }>(`/driver/vehicles/${vehicleId}/tech-passport`, {
    method: 'POST',
    body: form,
  })
}

// uploadFaceVerification отправляет селфи + документ (удостоверение/паспорт) на
// проверку поддержке (раньше грузилось только селфи и сразу считалось пройденным).
export function uploadFaceVerification(selfie: File, idDocument: File) {
  const form = new FormData()
  form.append('selfie', selfie)
  form.append('id_document', idDocument)
  return apiRequest<{ message: string }>('/driver/face-photo', {
    method: 'POST',
    body: form,
  })
}

export function submitDailyCheck(vehicleId: string, selfie: File, vehiclePhoto: File) {
  const form = new FormData()
  form.append('selfie', selfie)
  form.append('vehicle_photo', vehiclePhoto)
  form.append('vehicle_id', vehicleId)
  return apiRequest<DailyCheck>('/driver/daily-check', {
    method: 'POST',
    body: form,
  })
}
