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
  daily_check_valid: boolean
  vehicles: DriverVehicleVerification[]
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
