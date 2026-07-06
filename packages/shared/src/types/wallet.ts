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

// Привязанная карта (маскированный номер приходит с бэка как 4400-43XX-XXXX-1234).
export interface PaymentCard {
  card_pan: string
  created_at: string
  id: string
}

export interface WalletCardResponse {
  card: null | PaymentCard
}

export interface BindCardResponse {
  // Сумма платежа привязки (₸) — после оплаты зачисляется на баланс кошелька.
  amount: number
  redirect_url: string
}
