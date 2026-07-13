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
// Карт может быть несколько; поездки списываются с основной (is_default).
export interface PaymentCard {
  // Платёжная система из pg_card_brand шлюза (VISA/MASTERCARD…); пустая строка
  // у карт, привязанных до появления поля.
  card_brand: string
  card_pan: string
  created_at: string
  id: string
  is_default: boolean
}

export interface WalletCardResponse {
  // card — основная карта (легаси-поле времён одной карты; null, если карт нет).
  card: null | PaymentCard
  // cards — все активные карты, основная первой.
  cards: PaymentCard[]
}

export interface BindCardResponse {
  // Сумма платежа привязки (₸) — после оплаты зачисляется на баланс кошелька.
  amount: number
  redirect_url: string
}
