import type { TripChatMessagesResponse, TripChatsListResponse } from '~/types/trip-chats'
import { apiRequest } from '~/api/client'

// Контроль переписки поездок: read-only, доступен tech_support и admin
// (роут /tech-support/* гейтится requireStaff на бэке).
export function listTripChats(limit = 30, offset = 0) {
  return apiRequest<TripChatsListResponse>('/tech-support/trip-chats', {
    params: { limit, offset },
  })
}

export function getTripChatMessages(tripId: string, limit = 200, offset = 0) {
  return apiRequest<TripChatMessagesResponse>(`/tech-support/trip-chats/${tripId}/messages`, {
    params: { limit, offset },
  })
}

// Блокировка пользователя оператором поддержки («наказание» на N часов с
// причиной). hours = 0 — бессрочная. Тот же формат, что и /admin/users/:id/block.
export function blockUserBySupport(userId: string, payload: { blocked: boolean, hours?: number, reason?: string }) {
  return apiRequest<{ is_blocked: boolean, message: string }>(`/tech-support/users/${userId}/block`, {
    method: 'PUT',
    body: payload,
  })
}
