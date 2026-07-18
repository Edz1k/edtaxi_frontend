import type {
  AuthLoginResponse,
  AuthSession,
  LinkPhoneResponse,
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

// Пересоздание ранее удалённой пассажирской роли (экран «Аккаунт удалён»).
// Бэк восстанавливает роль и перевыпускает токен-cookie.
export function recreatePassengerAccount() {
  return apiRequest<AuthLoginResponse>('/account/passenger', {
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

// Привязка обязательного номера телефона к вошедшему аккаунту без OTP:
// contactData — сырой подписанный ответ Telegram requestContact, бэкенд
// проверяет подпись бота и принадлежность контакта владельцу сессии.
export function linkTelegramPhone(contactData: string, deviceFingerprint?: string) {
  return apiRequest<LinkPhoneResponse>('/auth/phone/telegram', {
    method: 'POST',
    deviceFingerprint,
    body: { contact_data: contactData },
  })
}

// OTP-фолбэк привязки номера (requestContact недоступен или пользователь отказал).
export function sendLinkPhoneOtp(payload: SendOtpPayload) {
  return apiRequest<SendOtpResponse>('/auth/phone/send', {
    method: 'POST',
    body: { phone: payload.phone },
  })
}

export function verifyLinkPhoneOtp(payload: VerifyOtpPayload) {
  return apiRequest<LinkPhoneResponse>('/auth/phone/verify', {
    method: 'POST',
    deviceFingerprint: payload.deviceFingerprint,
    body: { phone: payload.phone, code: payload.code },
  })
}
