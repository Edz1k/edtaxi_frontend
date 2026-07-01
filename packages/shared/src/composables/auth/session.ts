const OBSOLETE_ACCESS_TOKEN_KEY = 'taxiapp_access_token'
const OBSOLETE_REFRESH_TOKEN_KEY = 'taxiapp_refresh_token'
const PHONE_KEY = 'taxiapp_pending_phone'
const OTP_DELIVERY_METHOD_KEY = 'taxiapp_otp_delivery_method'
const DEVICE_FP_KEY = 'taxiapp_device_fp'
const OBSOLETE_ACTIVE_ROLE_KEY = 'taxiapp_active_role'
export const AUTH_SESSION_CHANGED_EVENT = 'edtaxi:auth-session-changed'

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

export function savePendingPhone(phone: string) {
  if (!canUseStorage())
    return

  sessionStorage.setItem(PHONE_KEY, phone)
}

export function clearPendingPhone() {
  if (!canUseStorage())
    return

  sessionStorage.removeItem(PHONE_KEY)
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

export function clearOtpDeliveryMethod() {
  if (!canUseStorage())
    return

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
