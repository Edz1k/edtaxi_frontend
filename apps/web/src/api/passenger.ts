import type { PassengerOverview } from '~/types/passenger-overview'
import { apiRequest } from '~/api/client'

// getPassengerOverview принимает user_id пассажира (в чате поддержки приходит
// как passenger_id).
export function getPassengerOverview(userId: string) {
  return apiRequest<PassengerOverview>(`/tech-support/passengers/${userId}/profile`)
}
