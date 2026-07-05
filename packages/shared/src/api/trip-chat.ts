import type { TripChatMessage, TripChatMessagesResponse } from '../types/trip-chat'
import { apiRequest } from './client'

// Чат поездки: писать можно, пока поездка активна; читать — и после завершения.
export function getTripChatMessages(tripId: string, limit = 100, offset = 0) {
  return apiRequest<TripChatMessagesResponse>(`/trips/${tripId}/chat/messages`, {
    params: { limit, offset },
  })
}

export function sendTripChatMessage(tripId: string, content: string) {
  return apiRequest<TripChatMessage>(`/trips/${tripId}/chat/messages`, {
    method: 'POST',
    body: { content },
  })
}

// uploadTripChatImage прикрепляет фотографию к чату поездки (multipart).
export function uploadTripChatImage(tripId: string, file: Blob) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<TripChatMessage>(`/trips/${tripId}/chat/image`, {
    method: 'POST',
    body: form,
  })
}
