export interface MessageResponse {
  message: string
}

export type AuthRole = 'admin' | 'driver' | 'park' | 'passenger' | 'superadmin' | 'tech_support'

// Used in taxiwebapp (web portal) to distinguish admin/park/tech_support login flows
export type AuthLoginFlow = 'admin' | 'park' | 'tech_support'

export type OtpDeliveryMethod = 'sms' | 'whatsapp'

export interface AuthLoginResponse {
  phone_verified?: boolean
  role: AuthRole
}

export interface AuthSession {
  avatar_url: null | string
  first_name: null | string
  id: string
  last_name: null | string
  phone: string
  role?: AuthRole
  roles: AuthRole[]
  telegram_user_id: null | number
}

export interface SendOtpPayload {
  channel?: OtpDeliveryMethod
  phone: string
}

export interface SendOtpResponse extends MessageResponse {
  phone: string
}

export interface VerifyOtpPayload {
  code: string
  deviceFingerprint?: string
  phone: string
}

export interface RefreshTokenPayload {
  deviceFingerprint?: string
}

export type LogoutPayload = Record<string, never>

export type LogoutAllPayload = Record<string, never>
