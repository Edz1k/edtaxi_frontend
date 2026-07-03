import type {
  AuthLoginResponse,
  AuthSession,
  LogoutAllPayload,
  LogoutPayload,
  MessageResponse,
  RefreshTokenPayload,
  SendOtpPayload,
  SendOtpResponse,
  VerifyOtpPayload,
} from '~/types/auth'
import { apiRequest } from '~/api/client'

export function sendOtp(payload: SendOtpPayload) {
  return apiRequest<SendOtpResponse>('/auth/otp/send', {
    method: 'POST',
    skipAuth: true,
    skipAuthRefresh: true,
    body: {
      channel: payload.channel,
      phone: payload.phone,
    },
  })
}

export function verifyOtp(payload: VerifyOtpPayload) {
  return apiRequest<AuthLoginResponse>('/auth/otp/verify', {
    method: 'POST',
    deviceFingerprint: payload.deviceFingerprint,
    skipAuth: true,
    skipAuthRefresh: true,
    body: {
      phone: payload.phone,
      code: payload.code,
    },
  })
}

export function refreshToken(payload: RefreshTokenPayload = {}) {
  return apiRequest<MessageResponse>('/auth/token/refresh', {
    method: 'POST',
    deviceFingerprint: payload.deviceFingerprint,
    skipAuth: true,
    skipAuthRefresh: true,
    body: {},
  })
}

export function getAuthSession() {
  return apiRequest<AuthSession>('/auth/session')
}

export function logout(_payload: LogoutPayload = {}) {
  return apiRequest<MessageResponse>('/auth/logout', {
    method: 'POST',
    skipAuthRefresh: true,
    body: {},
  })
}

export function logoutAll(_payload: LogoutAllPayload = {}) {
  return apiRequest<MessageResponse>('/auth/logout/all', {
    method: 'POST',
    body: {},
  })
}

export function sendDriverAuthOtp(payload: SendOtpPayload) {
  return apiRequest<SendOtpResponse>('/driver/auth/otp/send', {
    method: 'POST',
    skipAuth: true,
    skipAuthRefresh: true,
    body: { channel: payload.channel, phone: payload.phone },
  })
}

export function verifyDriverAuthOtp(payload: VerifyOtpPayload) {
  return apiRequest<AuthLoginResponse>('/driver/auth/otp/verify', {
    method: 'POST',
    deviceFingerprint: payload.deviceFingerprint,
    skipAuth: true,
    skipAuthRefresh: true,
    body: { phone: payload.phone, code: payload.code },
  })
}

// Тихий вход по подписанному Telegram initData (без OTP). Бэкенд проверяет
// подпись пассажирского бота и заводит/находит пользователя, ставя auth-cookie.
export function verifyTelegramPassenger(initData: string, deviceFingerprint?: string) {
  return apiRequest<AuthLoginResponse>('/auth/telegram/passenger', {
    method: 'POST',
    deviceFingerprint,
    skipAuth: true,
    skipAuthRefresh: true,
    body: { init_data: initData },
  })
}

export function syncTelegramName(initData: string) {
  return apiRequest<MessageResponse>('/auth/telegram/sync-name', {
    method: 'POST',
    body: { init_data: initData },
  })
}
