import type {
  ParkChatMessagesResponse,
  ParkChatRoom,
  ParkChatSendMessagePayload,
} from '~/types/parkChat'
import { apiRequest } from '~/api/client'

// openParkChatRoom открывает (или возвращает открытую) комнату чата водителя
// со своим таксопарком. 403, если водитель не состоит в парке.
export function openParkChatRoom() {
  return apiRequest<ParkChatRoom>('/driver/park-chat/rooms', {
    method: 'POST',
  })
}

export function getParkChatRoom(id: string) {
  return apiRequest<ParkChatRoom>(`/driver/park-chat/rooms/${id}`)
}

export function sendParkChatMessage(id: string, payload: ParkChatSendMessagePayload) {
  return apiRequest<ParkChatMessagesResponse['messages'][number]>(`/driver/park-chat/rooms/${id}/messages`, {
    method: 'POST',
    body: payload,
  })
}

export function getParkChatMessages(id: string, limit = 50, offset = 0) {
  return apiRequest<ParkChatMessagesResponse>(`/driver/park-chat/rooms/${id}/messages`, {
    params: { limit, offset },
  })
}

export function closeParkChatRoom(id: string) {
  return apiRequest<{ message: string }>(`/driver/park-chat/rooms/${id}/close`, {
    method: 'POST',
  })
}
