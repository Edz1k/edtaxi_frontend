import type { DriverOverview } from '~/types/driver-overview'
import { apiRequest } from '~/api/client'

// getDriverOverview принимает user_id водителя (то, что приходит в чате
// поддержки как passenger_id и в списке пользователей как id).
export function getDriverOverview(userId: string) {
  return apiRequest<DriverOverview>(`/tech-support/drivers/${userId}/profile`)
}

// --- Ручное управление рейтингом (только админ) ---

export function adminSetDriverRating(userId: string, rating: number, reason: string) {
  return apiRequest<{ message: string }>(`/admin/drivers/${userId}/rating`, {
    method: 'POST',
    body: { rating, reason },
  })
}

export function adminDeleteRatingEvent(userId: string, eventId: string) {
  return apiRequest<{ message: string }>(`/admin/drivers/${userId}/rating-events/${eventId}`, {
    method: 'DELETE',
  })
}

export function adminClearRatingEvents(userId: string) {
  return apiRequest<{ message: string }>(`/admin/drivers/${userId}/rating-events`, {
    method: 'DELETE',
  })
}

export function adminSetPassengerRating(userId: string, rating: number) {
  return apiRequest<{ message: string }>(`/admin/passengers/${userId}/rating`, {
    method: 'POST',
    body: { rating },
  })
}
