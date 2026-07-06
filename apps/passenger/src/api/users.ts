import { apiRequest } from '~/api/client'

// Статистика роста платформы для строки в меню:
// «Нас уже N пользователей, вы — №K».
export interface UserStatsResponse {
  total_users: number
  user_number: number
}

export function getUserStats() {
  return apiRequest<UserStatsResponse>('/users/stats')
}
