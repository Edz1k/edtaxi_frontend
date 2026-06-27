import type {
  AuthLoginFlow,
  AuthLoginResponse,
  AuthSession,
  LogoutPayload,
  MessageResponse,
  SendOtpPayload,
  SendOtpResponse,
  VerifyOtpPayload,
} from '~/types/auth'
import { apiRequest } from '~/api/client'

const AUTH_FLOW_ENDPOINTS: Record<AuthLoginFlow, { send: string, verify: string }> = {
  admin: {
    send: '/auth/otp/send',
    verify: '/auth/otp/verify',
  },
  park: {
    send: '/park/auth/otp/send',
    verify: '/park/auth/otp/verify',
  },
  tech_support: {
    send: '/tech-support/auth/otp/send',
    verify: '/tech-support/auth/otp/verify',
  },
}

export function sendOtp(payload: SendOtpPayload, flow: AuthLoginFlow = 'admin') {
  return apiRequest<SendOtpResponse>(AUTH_FLOW_ENDPOINTS[flow].send, {
    method: 'POST',
    skipAuth: true,
    skipAuthRefresh: true,
    body: {
      channel: payload.channel,
      phone: payload.phone,
    },
  })
}

export function verifyOtp(payload: VerifyOtpPayload, flow: AuthLoginFlow = 'admin') {
  return apiRequest<AuthLoginResponse>(AUTH_FLOW_ENDPOINTS[flow].verify, {
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
