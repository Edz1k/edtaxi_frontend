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
  // false, пока у аккаунта плейсхолдер вместо номера (вход через Telegram без
  // привязанного телефона) — приложение обязано показать шаг «поделиться номером».
  phone_verified?: boolean
  role?: AuthRole
  roles: AuthRole[]
  telegram_user_id: null | number
}

export interface LinkPhoneResponse extends MessageResponse {
  merged?: boolean
  phone: string
}

// Ответ POST /auth/telegram/login-request («Войти через Telegram» в веб-аппе).
export interface TelegramLoginRequestResponse {
  bot_username: string
  deep_link: string
  request_id: string
}

export type TelegramLoginStatus = 'approved' | 'expired' | 'pending'

// Ответ поллинга GET /auth/telegram/login-request/:id.
export interface TelegramLoginPollResponse {
  phone_verified?: boolean
  role?: AuthRole
  status: TelegramLoginStatus
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
