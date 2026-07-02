export type PayoutStatus = 'paid' | 'pending' | 'rejected'
export type PayoutRequesterType = 'driver' | 'park'

// Заявка на вывод средств водителя или парка. Сумма удерживается с баланса
// при создании, reject возвращает её обратно.
export interface PayoutRequest {
  id: string
  requester_type: PayoutRequesterType
  driver_id: null | string
  park_id: null | string
  amount: number
  destination: null | string
  status: PayoutStatus
  rejection_reason: null | string
  reviewed_at: null | string
  created_at: string
}

export interface PayoutsResponse {
  payouts: PayoutRequest[]
}

export interface ParkWallet {
  available_balance: number
  min_payout_amount: number
}

export interface PayoutCreatePayload {
  amount: number
  // destination — реквизиты получателя (карта/IBAN), вводит сам получатель.
  destination?: string
}

export interface AdminListPayoutsParams {
  limit?: number
  offset?: number
  status?: PayoutStatus | ''
}
