export type WalletTransactionType = 'fare_debit' | 'refund' | 'topup'

export interface Wallet {
  balance: number
  currency: string
}

export interface WalletTopUpPayload {
  amount: number
}

export interface WalletTopUpResponse {
  redirect_url: string
}

export interface WalletTransaction {
  amount: number
  balance_after: number
  created_at: string
  description: string
  id: string
  trip_id: null | string
  type: WalletTransactionType
}

export interface WalletHistoryResponse {
  limit: number
  offset: number
  transactions: WalletTransaction[]
}
