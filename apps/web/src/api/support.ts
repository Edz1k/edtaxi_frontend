import type {
  SupportListRoomsParams,
  SupportListRoomsResponse,
  SupportMessage,
  SupportMessagesResponse,
  SupportParticipantType,
  SupportRoom,
} from '~/types/support'
import type { Trip } from '~/types/trips'
import { apiRequest } from '~/api/client'

const SUPPORT_ROOM_LIST_ENDPOINTS: Record<SupportParticipantType, string> = {
  driver: '/tech-support/chats/drivers',
  passenger: '/tech-support/chats/passengers',
}

export function listTechSupportRooms(params: SupportListRoomsParams = {}) {
  const participantType = params.participant_type ?? 'passenger'

  return apiRequest<SupportListRoomsResponse>(SUPPORT_ROOM_LIST_ENDPOINTS[participantType], {
    params: {
      limit: params.limit,
      offset: params.offset,
      status: params.status || undefined,
    },
  })
}

export function getTechSupportRoom(id: string) {
  return apiRequest<SupportRoom>(`/tech-support/chats/rooms/${id}`)
}

// Деталь поездки для поддержки — та же форма ответа, что у GET /admin/trips/:id
// (пассажир и водитель с контактами): агент разбирает «забыл вещь» и споры,
// не прося админа.
export function getTechSupportTrip(id: string) {
  return apiRequest<Trip>(`/tech-support/trips/${id}`)
}

export function claimTechSupportRoom(id: string) {
  return apiRequest<SupportRoom>(`/tech-support/chats/rooms/${id}/claim`, {
    method: 'POST',
  })
}

export function closeTechSupportRoom(id: string) {
  return apiRequest<{ message: string }>(`/tech-support/chats/rooms/${id}/close`, {
    method: 'POST',
  })
}

export function getTechSupportMessages(id: string, params: { limit?: number, offset?: number } = {}) {
  return apiRequest<SupportMessagesResponse>(`/tech-support/chats/rooms/${id}/messages`, { params })
}

export function sendTechSupportMessage(id: string, content: string) {
  return apiRequest<SupportMessage>(`/tech-support/chats/rooms/${id}/messages`, {
    method: 'POST',
    body: { content },
  })
}
