import type { BonusOverview, BonusPromotionsResponse, RedeemReferralResponse } from '../types/bonus'
import { apiRequest } from './client'

// Бонусы платформы: баланс, реферальный код (создаётся на бэке при первом
// обращении) и правила начислений — для окна бонусов в мини-аппах.
export function getBonusOverview() {
  return apiRequest<BonusOverview>('/bonus/me')
}

export function redeemReferralCode(code: string) {
  return apiRequest<RedeemReferralResponse>('/bonus/referral/redeem', {
    method: 'POST',
    body: { code },
  })
}

// Активные акции для текущего пользователя (с его прогрессом по заказам).
// audience — какое мини-приложение спрашивает: пассажирское шлёт 'passenger',
// водительское 'driver'. Бэкенд пересекает с реальными ролями, чтобы двухролевой
// аккаунт не видел чужие акции (пассажир — водительские и наоборот).
export function getMyPromotions(audience?: 'driver' | 'passenger') {
  return apiRequest<BonusPromotionsResponse>(`/bonus/promotions${audience ? `?for=${audience}` : ''}`)
}

// Вступить в парковую акцию («Участвовать») — прогресс считается с этого
// момента; идемпотентно.
export function joinPromotion(id: string) {
  return apiRequest<{ message: string }>(`/bonus/promotions/${id}/join`, {
    method: 'POST',
  })
}
