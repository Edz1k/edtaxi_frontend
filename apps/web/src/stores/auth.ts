import type { TelegramCodeFlow } from '~/api/auth'
import type { AuthLoginFlow, AuthRole, AuthSession, OtpDeliveryMethod, TelegramLoginStatus } from '~/types/auth'
import { rememberAccount } from '@edtaxi/shared/composables/auth/saved-accounts'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { createTelegramLoginRequest, getAuthSession, logout as logoutRequest, pollTelegramLoginRequest, sendOtp, verifyOtp, verifyTelegramCode } from '~/api/auth'
import { ApiError } from '~/api/client'
import { showErrorToast } from '~/api/errors'
import {
  AUTH_SESSION_CHANGED_EVENT,
  clearPendingPhone,
  clearStoredAuthArtifacts,
  clearTokenPair,
  readDeviceFingerprint,
  readOtpDeliveryMethod,
  readPendingAuthFlow,
  readPendingPhone,
  saveDeviceFingerprint,
  saveOtpDeliveryMethod,
  savePendingAuthFlow,
  savePendingPhone,
} from '~/composables/auth/session'
import { useAdminStore } from '~/stores/admin'
import { useParkStore } from '~/stores/park'
import { useSupportStore } from '~/stores/support'
import { useVerificationStore } from '~/stores/verification'

// Список аккаунтов, под которыми входили в веб-кабинет (страница выбора
// аккаунта на входе техподдержки).
export const SAVED_ACCOUNTS_KEY = 'taxiwebapp_saved_accounts'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<AuthSession | null>(null)
  const pendingPhone = ref('')
  const pendingFlow = ref<AuthLoginFlow>('admin')
  const pendingOtpDeliveryMethod = ref<OtpDeliveryMethod>('whatsapp')
  const isLoading = ref(false)
  const errorMessage = ref('')
  const sessionStatus = ref<'authenticated' | 'guest' | 'unknown'>('unknown')
  let sessionChangeController: AbortController | null = null

  const isAuthenticated = computed(() => Boolean(currentUser.value))
  const roles = computed<AuthRole[]>(() => currentUser.value?.roles ?? [])
  const homePath = computed(() => {
    if (!isAuthenticated.value)
      return '/'

    if (hasAnyRole(['admin', 'superadmin']))
      return '/dashboard'

    if (hasRole('tech_support'))
      return '/support'

    if (hasRole('park'))
      return '/park'

    return '/dashboard'
  })

  function hasRole(role: AuthRole) {
    return roles.value.includes(role)
  }

  function hasAnyRole(requiredRoles: AuthRole[]) {
    return requiredRoles.some(role => hasRole(role))
  }

  function syncSession() {
    const storedPhone = readPendingPhone()

    if (storedPhone) {
      pendingPhone.value = storedPhone
      pendingFlow.value = readPendingAuthFlow()
      pendingOtpDeliveryMethod.value = readOtpDeliveryMethod()
    }
  }

  function clearRelatedStores() {
    useAdminStore().clearAdminState()
    useParkStore().clearParkState()
    useSupportStore().clearSupportState()
    useVerificationStore().clearVerificationState()
  }

  function clearLocalSession() {
    currentUser.value = null
    pendingPhone.value = ''
    pendingFlow.value = 'admin'
    pendingOtpDeliveryMethod.value = 'whatsapp'
    errorMessage.value = ''
    sessionStatus.value = 'guest'
    clearPendingPhone()
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

  function setPendingPhone(
    phone: string,
    flow: AuthLoginFlow = pendingFlow.value,
    channel: OtpDeliveryMethod = pendingOtpDeliveryMethod.value,
  ) {
    pendingPhone.value = phone
    pendingFlow.value = flow
    pendingOtpDeliveryMethod.value = channel

    if (phone) {
      savePendingPhone(phone)
      savePendingAuthFlow(flow)
      saveOtpDeliveryMethod(channel)
      return
    }

    clearPendingPhone()
  }

  function completeLogin() {
    clearStoredAuthArtifacts()
    clearPendingPhone()
    pendingPhone.value = ''
    pendingFlow.value = 'admin'
    pendingOtpDeliveryMethod.value = 'whatsapp'
  }

  function clearPendingLogin() {
    pendingPhone.value = ''
    pendingFlow.value = 'admin'
    pendingOtpDeliveryMethod.value = 'whatsapp'
    clearPendingPhone()
  }

  function clearSession() {
    clearLocalSession()
    clearTokenPair()
  }

  async function restoreSession(options: { force?: boolean } = {}) {
    syncSession()
    listenSessionChanges()

    if (!options.force && sessionStatus.value !== 'unknown')
      return currentUser.value

    try {
      const session = await getAuthSession()
      currentUser.value = session
      sessionStatus.value = 'authenticated'
      rememberAccount(SAVED_ACCOUNTS_KEY, {
        avatarUrl: session.avatar_url,
        firstName: session.first_name,
        id: session.id,
        lastName: session.last_name,
        phone: session.phone,
        role: session.roles?.[0] ?? null,
      })
      return currentUser.value
    }
    catch (error) {
      currentUser.value = null
      sessionStatus.value = 'guest'

      // 401 — нет/истекла сессия; 403 — cookie указывает на заблокированный
      // аккаунт. И то и другое — «гость», а не ошибка навигации.
      if (error instanceof ApiError && (error.status === 0 || error.status === 401 || error.status === 403))
        return null

      throw error
    }
  }

  async function restoreSessionAfterLogin() {
    const session = await restoreSession({ force: true })

    if (!session)
      throw new ApiError(401, 'session restore failed after login', {})

    completeLogin()
    return session
  }

  function getDeviceFingerprint() {
    const existing = readDeviceFingerprint()

    if (existing)
      return existing

    const fingerprint = crypto.randomUUID()
    saveDeviceFingerprint(fingerprint)
    return fingerprint
  }

  async function requestOtp(
    phone: string,
    flow: AuthLoginFlow = 'admin',
    channel: OtpDeliveryMethod = 'whatsapp',
  ) {
    isLoading.value = true
    errorMessage.value = ''

    try {
      await sendOtp({ channel, phone }, flow)
      setPendingPhone(phone, flow, channel)
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось отправить код. Попробуйте еще раз.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  async function confirmOtp(code: string) {
    if (!pendingPhone.value)
      throw new Error('Missing pending phone')

    isLoading.value = true
    errorMessage.value = ''

    try {
      await verifyOtp(
        {
          phone: pendingPhone.value,
          code,
          deviceFingerprint: getDeviceFingerprint(),
        },
        pendingFlow.value,
      )

      await restoreSessionAfterLogin()
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось подтвердить код. Попробуйте еще раз.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  // --- «Войти через Telegram» (подтверждение входа в боте) ---

  const telegramLogin = ref<null | { botUsername: string, deepLink: string, requestId: string }>(null)

  // Создаёт запрос входа: пользователь открывает диплинк бота и делится
  // контактом с тем же номером, а веб-апп поллит статус (pollTelegramLogin).
  async function startTelegramLogin(phone: string, flow: AuthLoginFlow) {
    isLoading.value = true
    errorMessage.value = ''

    try {
      const response = await createTelegramLoginRequest(phone, flow)
      telegramLogin.value = {
        botUsername: response.bot_username,
        deepLink: response.deep_link,
        requestId: response.request_id,
      }
      return telegramLogin.value
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, 'Не удалось начать вход через Telegram.')
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  // Один шаг поллинга. На approved бэкенд уже поставил cookies — остаётся
  // восстановить сессию. Возвращает статус, чтобы компонент управлял циклом.
  async function pollTelegramLogin(): Promise<TelegramLoginStatus> {
    if (!telegramLogin.value)
      return 'expired'

    const response = await pollTelegramLoginRequest(telegramLogin.value.requestId, getDeviceFingerprint())

    if (response.status === 'approved') {
      telegramLogin.value = null
      await restoreSessionAfterLogin()
    }
    else if (response.status === 'expired') {
      telegramLogin.value = null
    }

    return response.status
  }

  function cancelTelegramLogin() {
    telegramLogin.value = null
  }

  // Вход по коду из Telegram-бота: номер телефона не нужен, код сам
  // идентифицирует пользователя.
  async function confirmTelegramCode(code: string, flow: TelegramCodeFlow) {
    isLoading.value = true
    errorMessage.value = ''

    try {
      await verifyTelegramCode({ code, deviceFingerprint: getDeviceFingerprint() }, flow)
      await restoreSessionAfterLogin()
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
    cancelTelegramLogin,
    clearSession,
    clearPendingLogin,
    confirmOtp,
    confirmTelegramCode,
    currentUser,
    errorMessage,
    getDeviceFingerprint,
    hasAnyRole,
    hasRole,
    homePath,
    isAuthenticated,
    isLoading,
    loadSession,
    logout,
    pendingPhone,
    pendingFlow,
    pendingOtpDeliveryMethod,
    pollTelegramLogin,
    requestOtp,
    restoreSession,
    roles,
    setPendingPhone,
    sessionStatus,
    startTelegramLogin,
    stopListeningSessionChanges,
    telegramLogin,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore as any, import.meta.hot))
