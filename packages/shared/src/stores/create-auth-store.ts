import type { AuthRole, AuthSession, OtpDeliveryMethod, SendOtpPayload, VerifyOtpPayload } from '../types/auth'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError } from '../api/client'
import { showErrorToast } from '../api/errors'
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
} from '../composables/auth/session'
import { normalizeSession } from '../composables/auth/session-roles'
import { getTelegramInitData, isTelegramWebApp } from '../composables/auth/telegram'

export interface AuthStoreApi {
  getAuthSession: () => Promise<AuthSession>
  logout: () => Promise<unknown>
  sendDriverAuthOtp: (payload: SendOtpPayload) => Promise<unknown>
  sendOtp: (payload: SendOtpPayload) => Promise<unknown>
  syncTelegramName: (initData: string) => Promise<unknown>
  verifyDriverAuthOtp: (payload: VerifyOtpPayload) => Promise<unknown>
  verifyOtp: (payload: VerifyOtpPayload) => Promise<unknown>
  // Role-specific silent Telegram login (passenger vs driver bot signature).
  verifyTelegramSilent: (initData: string, deviceFingerprint?: string) => Promise<unknown>
}

export interface CreateAuthStoreOptions {
  api: AuthStoreApi
  // Reset the app's own feature stores when the auth session is cleared.
  clearRelatedStores: () => void
}

// Shared passenger/driver auth store. Both apps have identical session-restore,
// OTP and silent-login logic; only the Telegram verify endpoint and which
// sibling stores to reset differ, so those are injected.
export function createAuthStore({ api, clearRelatedStores }: CreateAuthStoreOptions) {
  return defineStore('auth', () => {
    const currentUser = ref<AuthSession | null>(null)
    const pendingPhone = ref('')
    const pendingOtpDeliveryMethod = ref<OtpDeliveryMethod>('whatsapp')
    const isLoading = ref(false)
    const errorMessage = ref('')
    const sessionStatus = ref<'authenticated' | 'guest' | 'unknown'>('unknown')
    let sessionChangeController: AbortController | null = null

    const isAuthenticated = computed(() => Boolean(currentUser.value))
    const role = computed<AuthRole | null>(() => currentUser.value?.role ?? null)

    function syncSession() {
      const storedPhone = readPendingPhone()

      if (storedPhone)
        pendingPhone.value = storedPhone

      pendingOtpDeliveryMethod.value = readOtpDeliveryMethod()
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

    // loadServerSession читает текущую сессию с сервера и раскладывает её в стор.
    // Возвращает нормализованную сессию или null (нет сессии / 401 / сеть недоступна);
    // прочие ошибки пробрасывает.
    async function loadServerSession(preferredRole?: AuthRole) {
      try {
        const session = normalizeSession(await api.getAuthSession(), preferredRole)
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

    // Внутри Telegram Mini App можно войти молча по подписанному initData, не гоняя
    // пользователя через OTP заново после того как истекла/потерялась сессия.
    // Возвращает true, если серверная auth-cookie успешно выставлена.
    async function tryTelegramSilentLogin() {
      if (!isTelegramWebApp())
        return false

      const initData = getTelegramInitData()
      if (!initData)
        return false

      try {
        await api.verifyTelegramSilent(initData, getDeviceFingerprint())
        return true
      }
      catch {
        return false
      }
    }

    async function restoreSession(options: { force?: boolean, preferredRole?: AuthRole } = {}) {
      syncSession()
      listenSessionChanges()

      if (!options.force && sessionStatus.value !== 'unknown')
        return currentUser.value

      const session = await loadServerSession(options.preferredRole)
      if (session)
        return session

      // Серверной сессии нет — прежде чем показывать OTP, пробуем тихий вход
      // через Telegram (в мини-аппе). При успехе перечитываем сессию.
      if (await tryTelegramSilentLogin())
        return loadServerSession(options.preferredRole)

      return null
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

      api.syncTelegramName(initData).catch(() => {})
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
        await api.sendOtp({ channel, phone })
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
        await api.verifyOtp({
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
        await api.sendDriverAuthOtp({ phone, channel })
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
        await api.verifyDriverAuthOtp({
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
        await api.logout()
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
}
