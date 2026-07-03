import type {
  OpenSupportRoomPayload,
  SupportListRoomsResponse,
  SupportMessage,
  SupportMessagesResponse,
  SupportParticipantType,
  SupportRoom,
  SupportSendMessagePayload,
} from '../types/support'
import { apiRequest } from './client'

// listSupportRooms возвращает обращения текущего пользователя (тикеты).
export function listSupportRooms(participantType: SupportParticipantType) {
  return apiRequest<SupportListRoomsResponse>('/support/rooms', {
    params: { participant_type: participantType },
  })
}

export function openSupportRoom(payload: OpenSupportRoomPayload = {}) {
  return apiRequest<SupportRoom>('/support/rooms', {
    method: 'POST',
    body: payload,
  })
}

export function getSupportRoom(id: string) {
  return apiRequest<SupportRoom>(`/support/rooms/${id}`)
}

export function sendSupportMessage(id: string, payload: SupportSendMessagePayload) {
  return apiRequest<SupportMessage>(`/support/rooms/${id}/messages`, {
    method: 'POST',
    body: payload,
  })
}

// uploadSupportImage прикрепляет фотографию к обращению (multipart).
export function uploadSupportImage(id: string, file: Blob) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<SupportMessage>(`/support/rooms/${id}/image`, {
    method: 'POST',
    body: form,
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
