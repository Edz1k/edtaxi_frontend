export type VerificationStatus = 'approved' | 'pending' | 'rejected'

export interface PendingVehicle {
  id: string
  driver_id: string
  // driver_* подтягиваются бэкендом, чтобы показывать имя водителя вместо UUID
  // и давать ссылку в его кабинет (driver_user_id).
  driver_name?: string
  driver_phone?: string
  driver_user_id?: string
  category: string
  plate_number: string
  make: string
  model: string
  year: number
  color: string
  is_active: boolean
  verification_status: VerificationStatus
  verification_photo_url: null | string
  reviewed_by: null | string
  reviewed_at: null | string
  created_at: string
}

export interface DailyCheck {
  id: string
  driver_id: string
  driver_name?: string
  driver_phone?: string
  driver_user_id?: string
  vehicle_id: string
  selfie_url: null | string
  vehicle_photo_url: null | string
  driver_face_photo_url: null | string
  vehicle_tech_passport_photo_url: null | string
  status: VerificationStatus
  rejection_reason: null | string
  reviewed_by: null | string
  reviewed_at: null | string
  created_at: string
}

export interface VehiclesResponse {
  vehicles: PendingVehicle[]
}

export interface DailyChecksResponse {
  daily_checks: DailyCheck[]
}
