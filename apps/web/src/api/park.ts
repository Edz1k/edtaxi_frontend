import type {
  AdminParkChangeRequestsResponse,
  AdminParkChatsResponse,
  AdminParksResponse,
  CreatePlatformGaragePayload,
  ParkAnalytics,
  ParkChangeRequest,
  ParkChangeRequestPayload,
  ParkChangeRequestResponse,
  ParkChatMessage,
  ParkChatMessagesResponse,
  ParkChatRoom,
  ParkChatRoomsResponse,
  ParkDailyAnalyticsResponse,
  ParkDriversResponse,
  ParkInvite,
  ParkInvitesResponse,
  ParkStatus,
  PlatformGarageResponse,
  TaxiPark,
  TaxiParkRegisterPayload,
  TaxiParkUpdatePayload,
} from '~/types/park'
import type { ParkWallet, PayoutCreatePayload, PayoutRequest, PayoutsResponse } from '~/types/payout'
import type { ParkJoinRequest } from '~/types/promotions'
import { apiRequest } from '~/api/client'

export function registerPark(payload: TaxiParkRegisterPayload) {
  return apiRequest<TaxiPark>('/park/register', {
    method: 'POST',
    body: payload,
  })
}

export function getMyPark(parkId?: string) {
  return apiRequest<TaxiPark>('/park/me', { params: { park_id: parkId } })
}

export function updateMyPark(payload: TaxiParkUpdatePayload) {
  return apiRequest<TaxiPark>('/park/me', {
    method: 'PUT',
    body: payload,
  })
}

// Идемпотентно: у парка одна постоянная ссылка, повторный вызов вернёт её же.
export function createParkInvite() {
  return apiRequest<ParkInvite>('/park/invites', {
    method: 'POST',
  })
}

// Перевыпуск: прежний токен и розданный по нему QR сразу перестают работать.
export function rotateParkInvite() {
  return apiRequest<ParkInvite>('/park/invites/rotate', {
    method: 'POST',
  })
}

export function listParkInvites(parkId?: string) {
  return apiRequest<ParkInvitesResponse>('/park/invites', { params: { park_id: parkId } })
}

// Заявка парка на изменение БИН/комиссии — применяется после одобрения админом.
export function submitParkChangeRequest(payload: ParkChangeRequestPayload) {
  return apiRequest<ParkChangeRequest>('/park/change-request', {
    method: 'POST',
    body: payload,
  })
}

// Активная (ожидающая) заявка парка — для баннера в кабинете.
export function getMyParkChangeRequest() {
  return apiRequest<ParkChangeRequestResponse>('/park/change-request')
}

export function listParkDrivers(parkId?: string) {
  return apiRequest<ParkDriversResponse>('/park/drivers', { params: { park_id: parkId } })
}

export function removeParkDriver(id: string) {
  return apiRequest<{ message: string }>(`/park/drivers/${id}`, {
    method: 'DELETE',
  })
}

export function getParkAnalytics(parkId?: string) {
  return apiRequest<ParkAnalytics>('/park/analytics', { params: { park_id: parkId } })
}

// Дневная серия завершённых поездок парка (по умолчанию 30 дней, максимум 90).
export function getParkDailyAnalytics(parkId?: string, days = 30) {
  return apiRequest<ParkDailyAnalyticsResponse>('/park/analytics/daily', { params: { days, park_id: parkId } })
}

// Park wallet (park owner side)
export function getParkWallet() {
  return apiRequest<ParkWallet>('/park/wallet')
}

export function requestParkPayout(payload: PayoutCreatePayload) {
  return apiRequest<PayoutRequest>('/park/wallet/payout', {
    method: 'POST',
    body: payload,
  })
}

export function listParkPayouts(params: { limit?: number, offset?: number } = {}) {
  return apiRequest<PayoutsResponse>('/park/wallet/payouts', { params })
}

// Park chat (park owner side)
export function listParkChatRooms(params: { status?: string, limit?: number, offset?: number } = {}) {
  return apiRequest<ParkChatRoomsResponse>('/park/chat/rooms', { params })
}

export function getParkChatRoom(id: string) {
  return apiRequest<ParkChatRoom>(`/park/chat/rooms/${id}`)
}

export function sendParkChatMessage(roomId: string, content: string) {
  return apiRequest<ParkChatMessage>(`/park/chat/rooms/${roomId}/messages`, {
    method: 'POST',
    body: { content },
  })
}

export function getParkChatMessages(roomId: string, params: { limit?: number, offset?: number } = {}) {
  return apiRequest<ParkChatMessagesResponse>(`/park/chat/rooms/${roomId}/messages`, { params })
}

export function closeParkChatRoom(roomId: string) {
  return apiRequest<{ message: string }>(`/park/chat/rooms/${roomId}/close`, {
    method: 'POST',
  })
}

// Admin park management
export function listAdminParks(params: { status?: ParkStatus | '', limit?: number, offset?: number } = {}) {
  return apiRequest<AdminParksResponse>('/admin/parks', {
    params: {
      status: params.status || undefined,
      limit: params.limit,
      offset: params.offset,
    },
  })
}

export function verifyAdminPark(id: string) {
  return apiRequest<{ message: string }>(`/admin/parks/${id}/verify`, {
    method: 'POST',
  })
}

export function rejectAdminPark(id: string, reason = '') {
  return apiRequest<{ message: string }>(`/admin/parks/${id}/reject`, {
    method: 'POST',
    body: { reason },
  })
}

// Отмечает парк «партнёром платформы» — водители из платформенных акций
// подают заявки на вступление именно в него.
export function setAdminParkPlatform(id: string, isPlatform: boolean) {
  return apiRequest<{ message: string }>(`/admin/parks/${id}/platform`, {
    method: 'PUT',
    body: { is_platform: isPlatform },
  })
}

export function listAdminParkChats(params: { limit?: number, offset?: number, status?: string } = {}) {
  return apiRequest<AdminParkChatsResponse>('/admin/park-chats', {
    params,
  })
}

// Заявки парков на изменение БИН/комиссии — админ одобряет/отклоняет.
export function listAdminParkChangeRequests() {
  return apiRequest<AdminParkChangeRequestsResponse>('/admin/park-change-requests')
}

export function approveParkChangeRequest(id: string) {
  return apiRequest<ParkChangeRequest>(`/admin/park-change-requests/${id}/approve`, {
    method: 'POST',
  })
}

export function rejectParkChangeRequest(id: string) {
  return apiRequest<ParkChangeRequest>(`/admin/park-change-requests/${id}/reject`, {
    method: 'POST',
  })
}

// --- «Гараж платформы» — платформенный парк, заявки и водители. ---

// 404 ("no platform park") означает, что гараж ещё не создан.
export function getPlatformGarage() {
  return apiRequest<PlatformGarageResponse>('/admin/parks/platform')
}

// Создаёт гараж: сразу approved + is_platform, комиссия парка 0.
export function createPlatformGarage(payload: CreatePlatformGaragePayload) {
  return apiRequest<TaxiPark>('/admin/parks/platform', {
    method: 'POST',
    body: payload,
  })
}

export function approvePlatformGarageRequest(id: string) {
  return apiRequest<ParkJoinRequest>(`/admin/parks/platform/requests/${id}/approve`, {
    method: 'POST',
  })
}

export function rejectPlatformGarageRequest(id: string) {
  return apiRequest<ParkJoinRequest>(`/admin/parks/platform/requests/${id}/reject`, {
    method: 'POST',
  })
}

// commission_rate — доля (0.03 = 3%); для гаража держим 0.
export function updateAdminPark(id: string, payload: TaxiParkUpdatePayload) {
  return apiRequest<TaxiPark>(`/admin/parks/${id}`, {
    method: 'PUT',
    body: payload,
  })
}
