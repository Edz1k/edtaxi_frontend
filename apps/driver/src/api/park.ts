import type { AvailableParksResponse, DriverAcceptInvitePayload, ParkInfo, ParkInvitePreview, ParkJoinRequest, ParkJoinRequestResponse } from '~/types/park'
import { apiRequest } from '~/api/client'

export function acceptParkInvite(payload: DriverAcceptInvitePayload) {
  return apiRequest<{ message: string }>('/driver/invite/accept', {
    method: 'POST',
    body: payload,
  })
}

// previewParkInvite — резолвит токен QR-приглашения в название парка и подсказку
// «вступление / смена», не совершая действия.
export function previewParkInvite(token: string) {
  return apiRequest<ParkInvitePreview>('/driver/invite/preview', {
    params: { token },
  })
}

// switchViaParkInvite — подтверждённое вступление или смена парка по токену
// (в отличие от acceptParkInvite не падает, если водитель уже в другом парке).
export function switchViaParkInvite(payload: DriverAcceptInvitePayload) {
  return apiRequest<{ message: string }>('/driver/invite/switch', {
    method: 'POST',
    body: payload,
  })
}

// listAvailableParks — список парков, к которым водитель может присоединиться.
export function listAvailableParks(params: { limit?: number, offset?: number } = {}) {
  return apiRequest<AvailableParksResponse>('/driver/parks', { params })
}

// getParkInfo — публичная карточка парка: описание, комиссия, активные акции.
export function getParkInfo(id: string) {
  return apiRequest<ParkInfo>(`/driver/parks/${id}`)
}

export function applyToPark(id: string) {
  return apiRequest<ParkJoinRequest>(`/driver/parks/${id}/apply`, {
    method: 'POST',
  })
}

// getPlatformParkAvailability — настроен ли «партнёр платформы» (показывать ли
// кнопку «Стать партнёром платформы»).
export function getPlatformParkAvailability() {
  return apiRequest<{ available: boolean }>('/driver/parks/platform')
}

export function applyToPlatformPark() {
  return apiRequest<ParkJoinRequest>('/driver/parks/platform/apply', {
    method: 'POST',
  })
}

// getMyParkRequest — активная заявка водителя (null — заявок нет).
export function getMyParkRequest() {
  return apiRequest<ParkJoinRequestResponse>('/driver/park-request')
}
