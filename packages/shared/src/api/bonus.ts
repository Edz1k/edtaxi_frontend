import type { BonusOverview, BonusPromotionsResponse } from '../types/bonus'
import { apiRequest } from './client'

// Бонусы платформы: баланс, реферальный код (создаётся на бэке при первом
// обращении) и правила начислений — для окна бонусов в мини-аппах.
export function getBonusOverview() {
  return apiRequest<BonusOverview>('/bonus/me')
}

export function redeemReferralCode(code: string) {
  return apiRequest<{ message: string }>('/bonus/referral/redeem', {
    method: 'POST',
    body: { code },
  })
}

// Активные акции для текущего пользователя (с его прогрессом по заказам).
export function getMyPromotions() {
  return apiRequest<BonusPromotionsResponse>('/bonus/promotions')
}
