import type { AuthRole, AuthSession, OtpDeliveryMethod, SendOtpPayload, VerifyOtpPayload } from '../types/auth'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError } from '../api/client'
import { showErrorToast } from '../api/errors'
import { rememberAccount } from '../composables/auth/saved-accounts'
import {
  AUTH_SESSION_CHANGED_EVENT,
  clearExplicitLogout,
  clearOtpDeliveryMethod,
  clearPendingPhone,
  clearStoredAuthArtifacts,
  clearTokenPair,
  readDeviceFingerprint,
  readExplicitLogout,
  readOtpDeliveryMethod,
  readPendingPhone,
  saveDeviceFingerprint,
  saveExplicitLogout,
  saveOtpDeliveryMethod,
  savePendingPhone,
} from '../composables/auth/session'
import { normalizeSession } from '../composables/auth/session-roles'
import { getTelegramInitData, isTelegramWebApp } from '../composables/auth/telegram'
import { requestTelegramContact } from '../composables/telegram/contact'

export interface AuthStoreApi {
  getAuthSession: () => Promise<AuthSession>
  // Привязка обязательного номера телефона к уже вошедшему аккаунту:
  // без OTP по подписанному ответу Telegram requestContact и OTP-фолбэк.
  linkTelegramPhone: (contactData: string, deviceFingerprint?: string) => Promise<unknown>
  logout: () => Promise<unknown>
  sendDriverAuthOtp: (payload: SendOtpPayload) => Promise<unknown>
  sendLinkPhoneOtp: (payload: SendOtpPayload) => Promise<unknown>
  sendOtp: (payload: SendOtpPayload) => Promise<unknown>
  syncTelegramName: (initData: string) => Promise<unknown>
  verifyDriverAuthOtp: (payload: VerifyOtpPayload) => Promise<unknown>
  verifyLinkPhoneOtp: (payload: VerifyOtpPayload) => Promise<unknown>
  verifyOtp: (payload: VerifyOtpPayload) => Promise<unknown>
  // Role-specific silent Telegram login (passenger vs driver bot signature).
  verifyTelegramSilent: (initData: string, deviceFingerprint?: string) => Promise<unknown>
  // Пересоздание ранее удалённой роли этого приложения (POST /account/<role>).
  // Каждый апп подставляет свою роль. Возвращает обновлённую сессию.
  recreateAccount: () => Promise<unknown>
}

export interface CreateAuthStoreOptions {
  api: AuthStoreApi
  // Reset the app's own feature stores when the auth session is cleared.
  clearRelatedStores: () => void
  // localStorage-ключ списка сохранённых аккаунтов (страница выбора аккаунта
  // после «Выйти»). У пассажирского и водительского аппов ключи разные.
  savedAccountsKey: string
}

// Shared passenger/driver auth store. Both apps have identical session-restore,
// OTP and silent-login logic; only the Telegram verify endpoint and which
// sibling stores to reset differ, so those are injected.
export function createAuthStore({ api, clearRelatedStores, savedAccountsKey }: CreateAuthStoreOptions) {
  return defineStore('auth', () => {
    const currentUser = ref<AuthSession | null>(null)
    const pendingPhone = ref('')
    const pendingOtpDeliveryMethod = ref<OtpDeliveryMethod>('whatsapp')
    const isLoading = ref(false)
    const errorMessage = ref('')
    const sessionStatus = ref<'authenticated' | 'guest' | 'unknown'>('unknown')
    // true, если роль этого приложения была удалена (двухролевой удалил её, но
    // сессия жива). Гард уводит на экран «создать заново». Ставится из ответа
    // входа (account_deleted), сбрасывается при выходе и успешном пересоздании.
    const accountDeleted = ref(false)
    let sessionChangeController: AbortController | null = null

    const isAuthenticated = computed(() => Boolean(currentUser.value))
    const role = computed<AuthRole | null>(() => currentUser.value?.role ?? null)
    // Номер обязателен для пассажиров и водителей: пока phone_verified=false
    // (вход через Telegram с плейсхолдер-номером), гард держит пользователя
    // на экране «Поделитесь номером».
    const phoneVerified = computed(() => currentUser.value?.phone_verified !== false)

    function syncSession() {
      const storedPhone = readPendingPhone()

      if (storedPhone)
        pendingPhone.value = storedPhone

      pendingOtpDeliveryMethod.value = readOtpDeliveryMethod()
    }

    // captureAccountDeleted — вытаскивает флаг из ответа входа (Telegram/OTP).
    function captureAccountDeleted(res: unknown) {
      accountDeleted.value = Boolean((res as { account_deleted?: boolean } | null)?.account_deleted)
    }

    function clearLocalSession() {
      currentUser.value = null
      pendingPhone.value = ''
      pendingOtpDeliveryMethod.value = 'whatsapp'
      errorMessage.value = ''
      sessionStatus.value = 'guest'
      accountDeleted.value = false
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
      clearExplicitLogout()
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
        if (session) {
          syncNameFromTelegram()
          rememberAccount(savedAccountsKey, {
            avatarUrl: session.avatar_url,
            firstName: session.first_name,
            id: session.id,
            lastName: session.last_name,
            phone: session.phone,
            role: session.role ?? null,
          })
        }
        return session
      }
      catch (error) {
        currentUser.value = null
        sessionStatus.value = 'guest'

        // 401 — нет/истекла сессия; 403 — cookie указывает на заблокированный
        // (например, слитый при мердже) аккаунт. И то и другое — «гость», а не
        // ошибка: дальше сработает тихий вход через Telegram или экран входа.
        if (error instanceof ApiError && (error.status === 0 || error.status === 401 || error.status === 403))
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

      // Пользователь сам нажал «Выйти» — не возвращаем его в тот же аккаунт
      // молча, иначе переключиться на другой аккаунт невозможно. Флаг
      // сбрасывается при явном входе (OTP или кнопка «Войти через Telegram»).
      if (readExplicitLogout())
        return false

      const initData = getTelegramInitData()
      if (!initData)
        return false

      try {
        captureAccountDeleted(await api.verifyTelegramSilent(initData, getDeviceFingerprint()))
        return true
      }
      catch {
        return false
      }
    }

    // Явный вход через Telegram (кнопка на странице выбора аккаунта) —
    // в отличие от тихого входа игнорирует флаг «Выйти» и сбрасывает его.
    async function loginWithTelegram() {
      if (!isTelegramWebApp())
        return null

      const initData = getTelegramInitData()
      if (!initData)
        return null

      isLoading.value = true
      errorMessage.value = ''
      try {
        captureAccountDeleted(await api.verifyTelegramSilent(initData, getDeviceFingerprint()))
        clearExplicitLogout()
        return await restoreSessionAfterLogin(undefined)
      }
      catch (error) {
        errorMessage.value = showErrorToast(error, 'Не удалось войти через Telegram.')
        throw error
      }
      finally {
        isLoading.value = false
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

    async function restoreSessionAfterLogin(preferredRole?: AuthRole) {
      const session = await restoreSession({ force: true, preferredRole })

      if (!session)
        throw new ApiError(401, 'session restore failed after login', {})

      completeLogin()
      return session
    }

    // Пересоздание удалённой роли этого приложения (экран «Аккаунт удалён.
    // Создать новый?»). Бэк восстанавливает роль и перевыпускает токен; затем
    // перезагружаем сессию, чтобы гард пропустил на защищённые роутом экраны.
    async function recreateAccount() {
      isLoading.value = true
      errorMessage.value = ''
      try {
        await api.recreateAccount()
        accountDeleted.value = false
        return await restoreSessionAfterLogin(role.value ?? undefined)
      }
      catch (error) {
        errorMessage.value = showErrorToast(error, 'Не удалось создать аккаунт заново.')
        throw error
      }
      finally {
        isLoading.value = false
      }
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
        // Запрещаем тихий Telegram-вход до следующего явного входа — иначе
        // мини-апп сразу вернул бы пользователя в покинутый аккаунт.
        saveExplicitLogout()
        clearSession()
        isLoading.value = false
      }
    }

    // --- обязательная привязка номера (экран «Поделитесь номером») ---

    // Привязка номера одним тапом через нативный диалог Telegram.
    // Возвращает false, если requestContact недоступен или пользователь
    // отказал — страница предлагает ввести номер вручную (OTP-фолбэк).
    async function linkPhoneViaTelegram() {
      const contactData = await requestTelegramContact()
      if (!contactData)
        return false

      isLoading.value = true
      errorMessage.value = ''
      try {
        await api.linkTelegramPhone(contactData, getDeviceFingerprint())
        await restoreSession({ force: true, preferredRole: role.value ?? undefined })
        return true
      }
      catch (error) {
        errorMessage.value = showErrorToast(error, 'Не удалось подтвердить номер. Попробуйте ещё раз.')
        throw error
      }
      finally {
        isLoading.value = false
      }
    }

    async function requestLinkPhoneOtp(phone: string, channel: OtpDeliveryMethod = 'whatsapp') {
      isLoading.value = true
      errorMessage.value = ''

      try {
        await api.sendLinkPhoneOtp({ channel, phone })
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

    async function confirmLinkPhoneOtp(code: string) {
      if (!pendingPhone.value)
        throw new Error('Missing pending phone')

      isLoading.value = true
      errorMessage.value = ''

      try {
        await api.verifyLinkPhoneOtp({
          phone: pendingPhone.value,
          code,
          deviceFingerprint: getDeviceFingerprint(),
        })

        await restoreSessionAfterLogin(role.value ?? undefined)
      }
      catch (error) {
        errorMessage.value = showErrorToast(error, 'Не удалось подтвердить код. Попробуйте еще раз.')
        throw error
      }
      finally {
        isLoading.value = false
      }
    }

    return {
      accountDeleted,
      recreateAccount,
      clearSession,
      confirmDriverOtp,
      confirmLinkPhoneOtp,
      confirmPassengerOtp,
      currentUser,
      errorMessage,
      getDeviceFingerprint,
      isAuthenticated,
      isLoading,
      linkPhoneViaTelegram,
      loadSession,
      loginWithTelegram,
      logout,
      pendingPhone,
      pendingOtpDeliveryMethod,
      phoneVerified,
      requestDriverOtp,
      requestLinkPhoneOtp,
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
