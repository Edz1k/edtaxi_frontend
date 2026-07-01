import type {
  OpenSupportRoomPayload,
  SupportMessagesResponse,
  SupportRoom,
  SupportSendMessagePayload,
} from '~/types/support'
import { apiRequest } from '~/api/client'

export function openSupportRoom(payload: OpenSupportRoomPayload = {}) {
  return apiRequest<SupportRoom>('/support/rooms', {
    method: 'POST',
    body: payload,
  })
}

export function sendSupportMessage(id: string, payload: SupportSendMessagePayload) {
  return apiRequest<SupportMessagesResponse['messages'][number]>(`/support/rooms/${id}/messages`, {
    method: 'POST',
    body: payload,
  })
}

export function getSupportMessages(id: string, limit = 50, offset = 0) {
  return apiRequest<SupportMessagesResponse>(`/support/rooms/${id}/messages`, {
    params: { limit, offset },
  })
}

export function closeSupportRoom(id: string) {
  return apiRequest<{ message: string }>(`/support/rooms/${id}/close`, {
    method: 'POST',
  })
}

// attachTripToSupport прикрепляет поездку к обращению — поддержка увидит, о какой
// поездке идёт речь.
export function attachTripToSupport(roomId: string, tripId: string) {
  return apiRequest<{ message: string }>(`/support/rooms/${roomId}/attach-trip`, {
    method: 'POST',
    body: { trip_id: tripId },
  })
}
