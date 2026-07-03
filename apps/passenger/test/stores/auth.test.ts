import type { AuthSession } from '~/types/auth'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '~/api/client'

const { getAuthSession } = vi.hoisted(() => ({ getAuthSession: vi.fn() }))

// Isolate the store from the network, storage, Telegram and sibling stores so
// the test exercises only the store's own session-restore / clear logic.
vi.mock('~/api/auth', () => ({
  getAuthSession,
  logout: vi.fn(),
  sendDriverAuthOtp: vi.fn(),
  sendOtp: vi.fn(),
  syncTelegramName: vi.fn(),
  verifyDriverAuthOtp: vi.fn(),
  verifyOtp: vi.fn(),
  verifyTelegramPassenger: vi.fn(),
}))
vi.mock('@edtaxi/shared/api/errors', () => ({ showErrorToast: vi.fn(() => 'error') }))
vi.mock('@edtaxi/shared/composables/auth/session', () => ({
  AUTH_SESSION_CHANGED_EVENT: 'edtaxi:auth-session-changed',
  clearOtpDeliveryMethod: vi.fn(),
  clearPendingPhone: vi.fn(),
  clearStoredAuthArtifacts: vi.fn(),
  clearTokenPair: vi.fn(),
  readDeviceFingerprint: vi.fn(() => 'fp'),
  readOtpDeliveryMethod: vi.fn(() => 'whatsapp'),
  readPendingPhone: vi.fn(() => ''),
  saveDeviceFingerprint: vi.fn(),
  saveOtpDeliveryMethod: vi.fn(),
  savePendingPhone: vi.fn(),
}))
vi.mock('@edtaxi/shared/composables/auth/telegram', () => ({
  getTelegramInitData: vi.fn(() => ''),
  isTelegramWebApp: vi.fn(() => false),
}))
vi.mock('~/stores/passenger', () => ({ usePassengerStore: () => ({ clearProfile: vi.fn() }) }))
vi.mock('~/stores/trips', () => ({ useTripsStore: () => ({ resetTripState: vi.fn() }) }))
vi.mock('~/stores/wallet', () => ({ useWalletStore: () => ({ clearWalletState: vi.fn() }) }))
vi.mock('~/stores/support', () => ({ useSupportStore: () => ({ clearSupportState: vi.fn() }) }))

const { useAuthStore } = await import('~/stores/auth')

function makeSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    avatar_url: null,
    first_name: 'Аружан',
    id: 'u1',
    last_name: null,
    phone: '+77010000000',
    roles: ['passenger'],
    telegram_user_id: null,
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  getAuthSession.mockReset()
})

describe('useAuthStore.restoreSession', () => {
  it('loads the server session and resolves the active role by priority', async () => {
    getAuthSession.mockResolvedValue(makeSession({ roles: ['driver', 'passenger'] }))
    const store = useAuthStore()

    const session = await store.restoreSession()

    expect(getAuthSession).toHaveBeenCalledTimes(1)
    expect(session?.role).toBe('passenger')
    expect(store.isAuthenticated).toBe(true)
    expect(store.sessionStatus).toBe('authenticated')
    expect(store.role).toBe('passenger')
  })

  it('does not re-fetch once the session status is known (unless forced)', async () => {
    getAuthSession.mockResolvedValue(makeSession())
    const store = useAuthStore()

    await store.restoreSession()
    await store.restoreSession()

    expect(getAuthSession).toHaveBeenCalledTimes(1)

    await store.restoreSession({ force: true })
    expect(getAuthSession).toHaveBeenCalledTimes(2)
  })

  it('treats a 401 as an anonymous session instead of throwing', async () => {
    getAuthSession.mockRejectedValue(new ApiError(401, 'invalid token', {}))
    const store = useAuthStore()

    const session = await store.restoreSession()

    expect(session).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(store.sessionStatus).toBe('guest')
  })
})

describe('useAuthStore.clearSession', () => {
  it('wipes the in-memory session and marks the user as a guest', async () => {
    getAuthSession.mockResolvedValue(makeSession())
    const store = useAuthStore()
    await store.restoreSession()
    expect(store.isAuthenticated).toBe(true)

    store.clearSession()

    expect(store.isAuthenticated).toBe(false)
    expect(store.currentUser).toBeNull()
    expect(store.sessionStatus).toBe('guest')
  })
})
