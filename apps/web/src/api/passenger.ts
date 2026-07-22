import type { BonusTransactionsResponse, PassengerOverview } from '~/types/passenger-overview'
import { apiRequest } from '~/api/client'

// getPassengerOverview принимает user_id пассажира (в чате поддержки приходит
// как passenger_id).
export function getPassengerOverview(userId: string) {
  return apiRequest<PassengerOverview>(`/tech-support/passengers/${userId}/profile`)
}

// grantBonus — ручная компенсация пассажиру. grant_id генерируется при открытии
// формы и делает повтор запроса идемпотентным: даблклик и ретрай сети не
// начислят бонусы дважды. Потолки (разовый и суточный) проверяет сервер.
export function grantBonus(userId: string, payload: { amount: number, grant_id: string, reason: string }) {
  return apiRequest<{ bonus_balance: number }>(`/tech-support/users/${userId}/bonus-grant`, {
    method: 'POST',
    body: payload,
  })
}

// История начислений: агент видит, кто и за что уже компенсировал.
export function getBonusTransactions(userId: string, limit = 20) {
  return apiRequest<BonusTransactionsResponse>(`/tech-support/users/${userId}/bonus-transactions`, {
    params: { limit },
  })
}
