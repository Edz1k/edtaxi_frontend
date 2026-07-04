import type { AuthRole, AuthSession } from '~/types/auth'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '~/api/client'

const { getAuthSession } = vi.hoisted(() => ({ getAuthSession: vi.fn() }))

// Isolate the store from the network, storage and sibling stores so the test
// exercises only the store's own session/role logic.
vi.mock('~/api/auth', () => ({
  createTelegramLoginRequest: vi.fn(),
  getAuthSession,
  logout: vi.fn(),
  pollTelegramLoginRequest: vi.fn(),
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  verifyTelegramCode: vi.fn(),
}))
vi.mock('~/api/errors', () => ({ showErrorToast: vi.fn(() => 'error') }))
vi.mock('~/composables/auth/session', () => ({
  AUTH_SESSION_CHANGED_EVENT: 'edtaxi:auth-session-changed',
  clearPendingPhone: vi.fn(),
  clearStoredAuthArtifacts: vi.fn(),
  clearTokenPair: vi.fn(),
  readDeviceFingerprint: vi.fn(() => 'fp'),
  readOtpDeliveryMethod: vi.fn(() => 'whatsapp'),
  readPendingAuthFlow: vi.fn(() => 'admin'),
  readPendingPhone: vi.fn(() => ''),
  saveDeviceFingerprint: vi.fn(),
  saveOtpDeliveryMethod: vi.fn(),
  savePendingAuthFlow: vi.fn(),
  savePendingPhone: vi.fn(),
}))
vi.mock('~/stores/admin', () => ({ useAdminStore: () => ({ clearAdminState: vi.fn() }) }))
vi.mock('~/stores/park', () => ({ useParkStore: () => ({ clearParkState: vi.fn() }) }))
vi.mock('~/stores/support', () => ({ useSupportStore: () => ({ clearSupportState: vi.fn() }) }))
vi.mock('~/stores/verification', () => ({ useVerificationStore: () => ({ clearVerificationState: vi.fn() }) }))

const { useAuthStore } = await import('~/stores/auth')

function makeSession(roles: AuthRole[]): AuthSession {
  return {
    avatar_url: null,
    first_name: 'Admin',
    id: 'w1',
    last_name: null,
    phone: '+77010000002',
    roles,
    telegram_user_id: null,
  }
}

async function restoreWith(roles: AuthRole[]) {
  getAuthSession.mockResolvedValue(makeSession(roles))
  const store = useAuthStore()
  await store.restoreSession()
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  getAuthSession.mockReset()
})

describe('useAuthStore.restoreSession', () => {
  it('loads the server session and exposes its roles', async () => {
    const store = await restoreWith(['admin', 'superadmin'])

    expect(getAuthSession).toHaveBeenCalledTimes(1)
    expect(store.isAuthenticated).toBe(true)
    expect(store.sessionStatus).toBe('authenticated')
    expect(store.roles).toEqual(['admin', 'superadmin'])
  })

  it('does not re-fetch once the session status is known (unless forced)', async () => {
    getAuthSession.mockResolvedValue(makeSession(['admin']))
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

describe('role helpers and homePath', () => {
  it('reports role membership via hasRole / hasAnyRole', async () => {
    const store = await restoreWith(['park'])

    expect(store.hasRole('park')).toBe(true)
    expect(store.hasRole('admin')).toBe(false)
    expect(store.hasAnyRole(['admin', 'park'])).toBe(true)
    expect(store.hasAnyRole(['admin', 'superadmin'])).toBe(false)
  })

  it('routes an anonymous user to the landing page', () => {
    const store = useAuthStore()
    expect(store.homePath).toBe('/')
  })

  it('routes each role to its home section', async () => {
    expect((await restoreWith(['admin'])).homePath).toBe('/dashboard')
    setActivePinia(createPinia())
    expect((await restoreWith(['superadmin'])).homePath).toBe('/dashboard')
    setActivePinia(createPinia())
    expect((await restoreWith(['tech_support'])).homePath).toBe('/support')
    setActivePinia(createPinia())
    expect((await restoreWith(['park'])).homePath).toBe('/park')
  })

  it('prefers the admin dashboard when a user holds several roles', async () => {
    const store = await restoreWith(['park', 'admin'])
    expect(store.homePath).toBe('/dashboard')
  })
})

describe('useAuthStore.clearSession', () => {
  it('wipes the in-memory session and marks the user as a guest', async () => {
    const store = await restoreWith(['admin'])
    expect(store.isAuthenticated).toBe(true)

    store.clearSession()

    expect(store.isAuthenticated).toBe(false)
    expect(store.currentUser).toBeNull()
    expect(store.sessionStatus).toBe('guest')
  })
})
