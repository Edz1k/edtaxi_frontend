import type { VehicleCategory } from '~/types/trips'

export type VerificationStatus = 'approved' | 'pending' | 'rejected'
export type DriverTripStep = 'arrived' | 'in_progress' | 'to_pickup'

export interface DriverVehicleVerification {
  id: string
  driver_id: string
  category: VehicleCategory
  plate_number: string
  make: string
  model: string
  year: number
  color: string
  is_active: boolean
  verification_status: VerificationStatus
  verification_photo_url: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface DriverVerificationsResponse {
  face_verified: boolean
  // face_status: none | pending | approved | rejected — статус проверки лица
  // поддержкой. face_photo_url появляется после загрузки селфи.
  face_status: 'approved' | 'none' | 'pending' | 'rejected'
  face_photo_url: null | string
  // has_approved_vehicle — есть хотя бы одна одобренная машина. Именно так
  // бэкенд решает, пускать ли водителя на линию.
  has_approved_vehicle: boolean
  daily_check_valid: boolean
  vehicles: DriverVehicleVerification[]
}

export type VerificationReminderItem = 'face' | 'vehicle'

export interface VerificationReminder {
  should_remind: boolean
  pending: VerificationReminderItem[]
  face_status: DriverVerificationsResponse['face_status']
}

export interface DailyCheck {
  id: string
  driver_id: string
  vehicle_id: string
  selfie_url: string
  vehicle_photo_url: string
  status: VerificationStatus
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface DriverProfile {
  id: string
  is_available: boolean
  is_online: boolean
  rating: number
  total_trips: number
  user_id: string
}

export interface DriverStatusResponse {
  is_available: boolean
  is_online: boolean
}

export interface DriverStatusPayload {
  is_online: boolean
}

export interface DriverVehiclePayload {
  category: VehicleCategory
  color: string
  make: string
  model: string
  plate_number: string
  year: number
}

export interface DriverVehicle extends DriverVehiclePayload {
  driver_id: string
  id: string
}

export interface DriverLocationPayload {
  heading?: number
  lat: number
  lng: number
  speed?: number
}

export interface DriverTripActionResponse {
  message: string
}

export interface DriverEarnings {
  total_earned: number
  trip_count: number
}

export interface DriverWallet {
  available_balance: number
  debt_balance: number
  min_balance_to_go_online: number
}

export interface DriverWalletTopUpPayload {
  amount: number
}

export interface DriverWalletTopUpResponse {
  redirect_url: string
}

// Минимальная сумма заявки на вывод (KZT) — как entity.MinPayoutAmount на бэке.
export const MIN_PAYOUT_AMOUNT = 1000

export type PayoutStatus = 'paid' | 'pending' | 'rejected'

export interface DriverPayoutPayload {
  amount: number
  // destination — реквизиты получателя (номер карты или IBAN)
  destination: string
}

export interface PayoutRequest {
  id: string
  requester_type: 'driver' | 'park'
  driver_id: null | string
  park_id: null | string
  amount: number
  destination: string
  status: PayoutStatus
  rejection_reason: null | string
  reviewed_at: null | string
  created_at: string
}

export interface DriverPayoutsResponse {
  payouts: PayoutRequest[]
}

export interface RatePassengerPayload {
  score: number
  comment?: string
}

export interface DriverPhoneOtpResponse {
  message: string
  phone: string
}

export interface DriverPhoneVerifyResponse {
  message: string
  phone: string
  // merged: true — номер принадлежал другому аккаунту, аккаунты объединены и
  // сессия перевыпущена. После этого нужно перечитать сессию.
  merged?: boolean
}
