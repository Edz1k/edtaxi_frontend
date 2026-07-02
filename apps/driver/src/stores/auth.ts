import type { AuthRole, AuthSession, OtpDeliveryMethod } from '~/types/auth'
import {
  AUTH_SESSION_CHANGED_EVENT,
  clearOtpDeliveryMethod,
  clearPendingPhone,
  clearStoredAuthArtifacts,
  clearTokenPair,
  readDeviceFingerprint,
  readOtpDeliveryMethod,
  readPendingPhone,
  saveDeviceFingerprint,
  saveOtpDeliveryMethod,
  savePendingPhone,
} from '@edtaxi/shared/composables/auth/session'
import { getTelegramInitData, isTelegramWebApp } from '@edtaxi/shared/composables/auth/telegram'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { getAuthSession, logout as logoutRequest, sendDriverAuthOtp, sendOtp, syncTelegramName, verifyDriverAuthOtp, verifyOtp } from '~/api/auth'
import { ApiError } from '~/api/client'
import { showErrorToast } from '~/api/errors'
import { useDriverStore } from '~/stores/driver'
import { useDriverEarningsStore } from '~/stores/driverEarnings'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'
import { useParkChatStore } from '~/stores/parkChat'
import { useSupportStore } from '~/stores/support'

const ROLE_PRIORITY: AuthRole[] = ['passenger', 'driver', 'admin', 'superadmin', 'tech_support', 'park']

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<AuthSession | null>(null)
  const pendingPhone = ref('')
  const pendingOtpDeliveryMethod = ref<OtpDeliveryMethod>('whatsapp')
  const isLoading = ref(false)
  const errorMessage = ref('')
  const sessionStatus = ref<'authenticated' | 'guest' | 'unknown'>('unknown')
  let sessionChangeController: AbortController | null = null

  const isAuthenticated = computed(() => Boolean(currentUser.value))
  const role = computed<AuthRole | null>(() => currentUser.value?.role ?? null)

  function isAuthRole(role: string): role is AuthRole {
    return ROLE_PRIORITY.includes(role as AuthRole)
  }

  function pickSessionRole(sessionRoles: AuthRole[], preferredRole?: AuthRole | null) {
    if (preferredRole && sessionRoles.includes(preferredRole))
      return preferredRole

    return ROLE_PRIORITY.find(role => sessionRoles.includes(role)) ?? null
  }

  function normalizeSession(session: AuthSession, preferredRole?: AuthRole | null): AuthSession | null {
    const rawRoles = session.roles?.length
      ? session.roles
      : session.role
        ? [session.role]
        : []
    const sessionRoles = Array.from(new Set(rawRoles.filter(isAuthRole)))
    const nextRole = pickSessionRole(sessionRoles, preferredRole)

    if (!nextRole)
      return null

    return {
      ...session,
      role: nextRole,
      roles: sessionRoles,
    }
  }

  function syncSession() {
    const storedPhone = readPendingPhone()

    if (storedPhone)
      pendingPhone.value = storedPhone

    pendingOtpDeliveryMethod.value = readOtpDeliveryMethod()
  }

  function clearRelatedStores() {
    useDriverStore().clearDriverState()
    useDriverOnboardingStore().clearOnboardingState()
    useDriverEarningsStore().clearEarningsState()
    useSupportStore().clearSupportState()
    useParkChatStore().clearParkChatState()
  }

  function clearLocalSession() {
    currentUser.value = null
    pendingPhone.value = ''
    pendingOtpDeliveryMethod.value = 'whatsapp'
    errorMessage.value = ''
    sessionStatus.value = 'guest'
    clearPendingPhone()
    clearOtpDeliveryMethod()
    clearRelatedStores()
  }

  function listenSessionChanges() {
    if (sessionChangeController || typeof window === 'undefined')
      return

    sessionChangeController = new AbortController()
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, clearLocalSession, {
      signal: sessionChangeController.signal,
    })
  }

  function stopListeningSessionChanges() {
    sessionChangeController?.abort()
    sessionChangeController = null
  }

  function loadSession() {
    syncSession()
    listenSessionChanges()
  }

  function setPendingPhone(phone: string) {
    pendingPhone.value = phone
    savePendingPhone(phone)
  }

  function setPendingOtpDeliveryMethod(method: OtpDeliveryMethod) {
    pendingOtpDeliveryMethod.value = method
    saveOtpDeliveryMethod(method)
  }

  function completeLogin() {
    clearStoredAuthArtifacts()
    clearPendingPhone()
    clearOtpDeliveryMethod()
    pendingPhone.value = ''
    pendingOtpDeliveryMethod.value = 'whatsapp'
  }

  function clearSession() {
    clearLocalSession()
    clearTokenPair()
  }

  async function restoreSession(options: { force?: boolean, preferredRole?: AuthRole } = {}) {
    syncSession()
    listenSessionChanges()

    if (!options.force && sessionStatus.value !== 'unknown')
      return currentUser.value

    try {
      const session = normalizeSession(await getAuthSession(), options.preferredRole)
      currentUser.value = session
      sessionStatus.value = session ? 'authenticated' : 'guest'
      if (session)
        syncNameFromTelegram()
      return session
    }
    catch (error) {
      currentUser.value = null
      sessionStatus.value = 'guest'

      if (error instanceof ApiError && (error.status === 0 || error.status === 401))
        return null

      throw error
    }
  }

  async function restoreSessionAfterLogin(preferredRole: AuthRole) {
    const session = await restoreSession({ force: true, preferredRole })

    if (!session)
      throw new ApiError(401, 'session restore failed after login', {})

    completeLogin()
    return session
  }

  // Если приложение открыто внутри Telegram, подставляем имя/фамилию из
  // Telegram в профиль (если их там ещё нет) — чтобы не просить пользователя
  // вводить имя вручную после входа по телефону+OTP. Не блокирует логин.
  function syncNameFromTelegram() {
    if (!isTelegramWebApp())
      return

    const initData = getTelegramInitData()
    if (!initData)
      return

    syncTelegramName(initData).catch(() => {})
  }

  function getDeviceFingerprint() {
    const existing = readDeviceFingerprint()

    if (existing)
      return existing

    const fingerprint = crypto.randomUUID()
    saveDeviceFingerprint(fingerprint)
    return fingerprint
  }

  async function requestPassengerOtp(phone: string, channel: OtpDeliveryMethod = 'whatsapp') {
    isLoading.value = true
    errorMessage.value = ''

    try {
      await sendOtp({ channel, phone })
      setPendingPhone(phone)
      setPendingOtpDeliveryMethod(channel)
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отправить код. Попробуйте еще раз.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function confirmPassengerOtp(code: string) {
    if (!pendingPhone.value)
      throw new Error('Missing pending phone')

    isLoading.value = true
    errorMessage.value = ''

    try {
      await verifyOtp({
        phone: pendingPhone.value,
        code,
        deviceFingerprint: getDeviceFingerprint(),
      })

      await restoreSessionAfterLogin('passenger')
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось подтвердить код. Попробуйте еще раз.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function requestDriverOtp(phone: string, channel: OtpDeliveryMethod = 'whatsapp') {
    isLoading.value = true
    errorMessage.value = ''

    try {
      await sendDriverAuthOtp({ phone, channel })
      setPendingPhone(phone)
      setPendingOtpDeliveryMethod(channel)
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отправить код. Попробуйте еще раз.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function confirmDriverOtp(code: string) {
    if (!pendingPhone.value)
      throw new Error('Missing pending phone')

    isLoading.value = true
    errorMessage.value = ''

    try {
      await verifyDriverAuthOtp({
        phone: pendingPhone.value,
        code,
        deviceFingerprint: getDeviceFingerprint(),
      })

      await restoreSessionAfterLogin('driver')
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось подтвердить код. Попробуйте еще раз.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function logout() {
    isLoading.value = true
    errorMessage.value = ''

    try {
      await logoutRequest()
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось завершить сессию на сервере.')
    }
    finally {
      clearSession()
      isLoading.value = false
    }
  }

  return {
    clearSession,
    confirmDriverOtp,
    confirmPassengerOtp,
    currentUser,
    errorMessage,
    getDeviceFingerprint,
    isAuthenticated,
    isLoading,
    loadSession,
    logout,
    pendingPhone,
    pendingOtpDeliveryMethod,
    requestDriverOtp,
    requestPassengerOtp,
    restoreSession,
    role,
    setPendingPhone,
    setPendingOtpDeliveryMethod,
    sessionStatus,
    stopListeningSessionChanges,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore as any, import.meta.hot))
