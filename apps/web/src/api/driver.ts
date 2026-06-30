import type { DriverOverview } from '~/types/driver-overview'
import { apiRequest } from '~/api/client'

// getDriverOverview принимает user_id водителя (то, что приходит в чате
// поддержки как passenger_id и в списке пользователей как id).
export function getDriverOverview(userId: string) {
  return apiRequest<DriverOverview>(`/tech-support/drivers/${userId}/profile`)
}
