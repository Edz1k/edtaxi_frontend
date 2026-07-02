import type {
  AdminParkChatsResponse,
  AdminParksResponse,
  ParkAnalytics,
  ParkChatMessage,
  ParkChatMessagesResponse,
  ParkChatRoom,
  ParkChatRoomsResponse,
  ParkDriversResponse,
  ParkInvite,
  ParkInvitesResponse,
  ParkStatus,
  TaxiPark,
  TaxiParkRegisterPayload,
  TaxiParkUpdatePayload,
} from '~/types/park'
import type { ParkWallet, PayoutCreatePayload, PayoutRequest, PayoutsResponse } from '~/types/payout'
import { apiRequest } from '~/api/client'

export function registerPark(payload: TaxiParkRegisterPayload) {
  return apiRequest<TaxiPark>('/park/register', {
    method: 'POST',
    body: payload,
  })
}

export function getMyPark() {
  return apiRequest<TaxiPark>('/park/me')
}

export function updateMyPark(payload: TaxiParkUpdatePayload) {
  return apiRequest<TaxiPark>('/park/me', {
    method: 'PUT',
    body: payload,
  })
}

export function createParkInvite() {
  return apiRequest<ParkInvite>('/park/invites', {
    method: 'POST',
  })
}

export function listParkInvites() {
  return apiRequest<ParkInvitesResponse>('/park/invites')
}

export function listParkDrivers() {
  return apiRequest<ParkDriversResponse>('/park/drivers')
}

export function removeParkDriver(id: string) {
  return apiRequest<{ message: string }>(`/park/drivers/${id}`, {
    method: 'DELETE',
  })
}

export function getParkAnalytics() {
  return apiRequest<ParkAnalytics>('/park/analytics')
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

export function listAdminParkChats(params: { limit?: number, offset?: number, status?: string } = {}) {
  return apiRequest<AdminParkChatsResponse>('/admin/park-chats', {
    params,
  })
}
