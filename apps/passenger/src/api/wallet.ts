import type { BindCardResponse, Wallet, WalletCardResponse, WalletHistoryResponse, WalletTopUpPayload, WalletTopUpResponse } from '@edtaxi/shared/types/wallet'
import { apiRequest } from '~/api/client'

export function getWallet() {
  return apiRequest<Wallet>('/wallet')
}

export function topUpWallet(payload: WalletTopUpPayload) {
  return apiRequest<WalletTopUpResponse>('/wallet/topup', {
    method: 'POST',
    body: payload,
  })
}

export function getWalletHistory(limit = 20, offset = 0) {
  return apiRequest<WalletHistoryResponse>('/wallet/history', {
    params: { limit, offset },
  })
}

// --- Привязанная карта ---

// getMyCard — активная привязанная карта ({ card: null }, если её нет).
export function getMyCard() {
  return apiRequest<WalletCardResponse>('/wallet/cards')
}

// bindCard — платёж привязки: пользователь оплачивает небольшую сумму на
// странице FreedomPay (redirect_url), она зачисляется на баланс, а карта
// сохраняется для оплаты поездок.
export function bindCard() {
  return apiRequest<BindCardResponse>('/wallet/cards/bind', {
    method: 'POST',
  })
}

export function unbindCard() {
  return apiRequest<{ message: string }>('/wallet/cards', {
    method: 'DELETE',
  })
}
