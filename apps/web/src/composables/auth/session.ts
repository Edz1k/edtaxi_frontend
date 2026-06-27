const OBSOLETE_ACCESS_TOKEN_KEY = 'taxiapp_access_token'
const OBSOLETE_REFRESH_TOKEN_KEY = 'taxiapp_refresh_token'
const OBSOLETE_ACTIVE_ROLE_KEY = 'taxiapp_active_role'
const PHONE_KEY = 'taxiwebapp_pending_phone'
const FLOW_KEY = 'taxiwebapp_pending_auth_flow'
const OTP_DELIVERY_METHOD_KEY = 'taxiwebapp_otp_delivery_method'
const DEVICE_FP_KEY = 'taxiwebapp_device_fp'
export const AUTH_SESSION_CHANGED_EVENT = 'edtaxi:auth-session-changed'

type StoredAuthFlow = 'admin' | 'park' | 'tech_support'

function canUseStorage() {
  return typeof window !== 'undefined'
}

function dispatchSessionChanged() {
  if (!canUseStorage())
    return

  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT))
}

export function clearObsoleteTokenStorage() {
  if (!canUseStorage())
    return

  localStorage.removeItem(OBSOLETE_ACCESS_TOKEN_KEY)
  localStorage.removeItem(OBSOLETE_REFRESH_TOKEN_KEY)
  localStorage.removeItem(OBSOLETE_ACTIVE_ROLE_KEY)
}

export function clearStoredAuthArtifacts() {
  clearObsoleteTokenStorage()
}

export function clearTokenPair() {
  clearObsoleteTokenStorage()
  dispatchSessionChanged()
}

export function readPendingPhone() {
  if (!canUseStorage())
    return ''

  return sessionStorage.getItem(PHONE_KEY) ?? ''
}

export function readPendingAuthFlow(): StoredAuthFlow {
  if (!canUseStorage())
    return 'admin'

  const value = sessionStorage.getItem(FLOW_KEY)

  return value === 'park' || value === 'tech_support' ? value : 'admin'
}

export function savePendingPhone(phone: string) {
  if (!canUseStorage())
    return

  sessionStorage.setItem(PHONE_KEY, phone)
}

export function savePendingAuthFlow(flow: StoredAuthFlow) {
  if (!canUseStorage())
    return

  sessionStorage.setItem(FLOW_KEY, flow)
}

export function readOtpDeliveryMethod() {
  if (!canUseStorage())
    return 'whatsapp'

  return sessionStorage.getItem(OTP_DELIVERY_METHOD_KEY) === 'sms' ? 'sms' : 'whatsapp'
}

export function saveOtpDeliveryMethod(method: 'sms' | 'whatsapp') {
  if (!canUseStorage())
    return

  sessionStorage.setItem(OTP_DELIVERY_METHOD_KEY, method)
}

export function clearPendingPhone() {
  if (!canUseStorage())
    return

  sessionStorage.removeItem(PHONE_KEY)
  sessionStorage.removeItem(FLOW_KEY)
  sessionStorage.removeItem(OTP_DELIVERY_METHOD_KEY)
}

export function readDeviceFingerprint() {
  if (!canUseStorage())
    return ''

  return localStorage.getItem(DEVICE_FP_KEY) ?? ''
}

export function saveDeviceFingerprint(fingerprint: string) {
  if (!canUseStorage())
    return

  localStorage.setItem(DEVICE_FP_KEY, fingerprint)
}
