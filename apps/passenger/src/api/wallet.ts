import type { Wallet, WalletHistoryResponse, WalletTopUpPayload, WalletTopUpResponse } from '@edtaxi/shared/types/wallet'
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
