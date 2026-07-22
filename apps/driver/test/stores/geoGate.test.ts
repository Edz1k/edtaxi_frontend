import type { DriverProfile } from '~/types/driver'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createDriverProfile, updateDriverStatus } = vi.hoisted(() => ({
  createDriverProfile: vi.fn(),
  updateDriverStatus: vi.fn(),
}))

vi.mock('~/api/driver', () => ({
  acceptDriverRouteChange: vi.fn(),
  acceptTrip: vi.fn(),
  cancelDriverTrip: vi.fn(),
  completeTrip: vi.fn(),
  createDriverProfile,
  driverArrived: vi.fn(),
  getActiveDriverTrip: vi.fn(),
  getDriverCategories: vi.fn(() => Promise.resolve({ active: [], available: [] })),
  getDriverDistricts: vi.fn(() => Promise.resolve({ active: [], available: [], city: '' })),
  getDriverRouteChange: vi.fn(),
  getHomeMode: vi.fn(() => Promise.resolve(null)),
  rejectDriverRouteChange: vi.fn(),
  rejectTrip: vi.fn(),
  setDriverActiveCategories: vi.fn(),
  setDriverActiveDistricts: vi.fn(),
  startTrip: vi.fn(),
  updateDriverStatus,
}))
vi.mock('~/api/errors', () => ({
  getUserErrorMessage: vi.fn(() => 'error'),
  showErrorToast: vi.fn(() => 'error'),
}))
vi.mock('~/composables/useToast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}))

const { useDriverStore } = await import('~/stores/driver')

function profile(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    id: 'driver-1',
    is_available: true,
    is_online: false,
    rating: 5,
    total_trips: 10,
    user_id: 'user-1',
    ...overrides,
  }
}

// Настройки гео-проверки приходят с сервера: и режим, и радиусы. Клиент их не
// хардкодит, иначе калибровка радиусов после наблюдений требовала бы релиза
// водительской апы.
describe('гео-проверка из профиля водителя', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('старый бэкенд без geo_gate — гейт выключен', async () => {
    const store = useDriverStore()
    createDriverProfile.mockResolvedValue(profile())

    await store.ensureProfile()

    expect(store.geoGate).toBeNull()
  })

  it('радиусы и режим берутся из ответа сервера', async () => {
    const store = useDriverStore()
    createDriverProfile.mockResolvedValue(profile({
      geo_gate: { arrival_radius_m: 300, completion_radius_m: 700, mode: 'enforce' },
    }))

    await store.ensureProfile()

    expect(store.geoGate).toEqual({ arrival_radius_m: 300, completion_radius_m: 700, mode: 'enforce' })
  })

  // Смена режима на сервере иначе доехала бы до водителя только после
  // перезапуска приложения.
  it('выход на линию перечитывает профиль', async () => {
    const store = useDriverStore()
    createDriverProfile.mockResolvedValue(profile({
      geo_gate: { arrival_radius_m: 300, completion_radius_m: 700, mode: 'warn' },
    }))
    await store.ensureProfile()
    expect(store.geoGate?.mode).toBe('warn')

    updateDriverStatus.mockResolvedValue({ is_available: true, is_online: true })
    createDriverProfile.mockResolvedValue(profile({
      geo_gate: { arrival_radius_m: 250, completion_radius_m: 600, mode: 'enforce' },
      is_online: true,
    }))

    await store.setOnline(true)
    await vi.waitFor(() => expect(store.geoGate?.mode).toBe('enforce'))
    expect(store.geoGate?.arrival_radius_m).toBe(250)
  })

  it('уход в оффлайн профиль не перечитывает', async () => {
    const store = useDriverStore()
    createDriverProfile.mockResolvedValue(profile({ is_online: true }))
    await store.ensureProfile()
    createDriverProfile.mockClear()

    updateDriverStatus.mockResolvedValue({ is_available: false, is_online: false })
    await store.setOnline(false)

    expect(createDriverProfile).not.toHaveBeenCalled()
  })
})
