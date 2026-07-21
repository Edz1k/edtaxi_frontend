import type { Trip } from '~/types/trips'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getActiveTrip, getTrip, rateTrip } = vi.hoisted(() => ({
  getActiveTrip: vi.fn(),
  getTrip: vi.fn(),
  rateTrip: vi.fn(),
}))

vi.mock('~/api/trips', () => ({
  cancelRouteChange: vi.fn(),
  cancelTrip: vi.fn(),
  createTrip: vi.fn(),
  estimateTrip: vi.fn(),
  fileTripComplaint: vi.fn(),
  getActiveTrip,
  getPendingRouteChange: vi.fn(() => Promise.resolve(null)),
  getTrip,
  getTripHistory: vi.fn(),
  proposeRouteChange: vi.fn(),
  rateTrip,
  retryTripPrepay: vi.fn(),
}))
vi.mock('~/api/pickupHints', () => ({ getPickupHints: vi.fn() }))
vi.mock('~/api/tariffs', () => ({ getTariffCategories: vi.fn() }))
vi.mock('~/api/errors', () => ({
  getUserErrorMessage: vi.fn(() => 'error'),
  showErrorToast: vi.fn(() => 'error'),
}))
vi.mock('~/utils/routeDraft', () => ({
  clearRouteDraft: vi.fn(),
  readRouteDraft: vi.fn(() => null),
  saveRouteDraft: vi.fn(),
}))

const { useTripsStore } = await import('~/stores/trips')

function completedTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    completed_at: '2026-07-21T10:00:00Z',
    driver: { name: 'Водитель', rating: 4.9 },
    final_fare: 1500,
    id: 'trip-finished',
    status: 'completed',
    stops: [],
    ...overrides,
  } as unknown as Trip
}

// Завершение поездки штатным путём (WS trip_status → applyTripStatus →
// finishActiveTrip): именно оно пишет терминальный снапшот.
function completeActiveTrip(store: ReturnType<typeof useTripsStore>) {
  store.activeTrip = completedTrip({ status: 'in_progress' } as Partial<Trip>)
  store.applyTripStatus('trip-finished', 'completed')
}

// Экран оценки не должен пропадать: GET /trips/active знает только
// НЕзавершённые поездки и отвечает null сразу после завершения — раньше это
// молча сбрасывало завершённую неоценённую поездку с экрана.
describe('персист завершённой неоценённой поездки', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('возврат из меню: null от /trips/active не сбрасывает неоценённую поездку с экрана', async () => {
    const store = useTripsStore()
    store.activeTrip = completedTrip()
    getActiveTrip.mockResolvedValue(null)

    const restored = await store.restoreActiveTrip()

    expect(restored?.id).toBe('trip-finished')
    expect(store.activeTrip?.id).toBe('trip-finished')
  })

  it('перезапуск приложения: снапшот из localStorage дотягивается свежим GET /trips/:id', async () => {
    const store = useTripsStore()
    // Завершение пишет терминальный снапшот...
    completeActiveTrip(store)
    // ...приложение перезапустили: стор пуст, снапшот остался.
    setActivePinia(createPinia())
    const freshStore = useTripsStore()
    getActiveTrip.mockResolvedValue(null)
    getTrip.mockResolvedValue(completedTrip({ final_fare: 1700 }))

    const restored = await freshStore.restoreActiveTrip()

    expect(getTrip).toHaveBeenCalledWith('trip-finished')
    // Показана свежая версия: в ней итоговая цена с бэка.
    expect(restored?.final_fare).toBe(1700)
    expect(freshStore.activeTrip?.status).toBe('completed')
  })

  it('поездка уже оценена (с другого устройства) — снапшот очищается, экран не восстанавливается', async () => {
    const store = useTripsStore()
    completeActiveTrip(store)
    setActivePinia(createPinia())
    const freshStore = useTripsStore()
    getActiveTrip.mockResolvedValue(null)
    getTrip.mockResolvedValue(completedTrip({ my_rating: { comment: null, score: 5 } }))

    const restored = await freshStore.restoreActiveTrip()

    expect(restored).toBeNull()
    expect(freshStore.activeTrip).toBeNull()
    // Повторный рестарт не должен снова ходить за оценённой поездкой.
    getTrip.mockClear()
    await freshStore.restoreActiveTrip()
    expect(getTrip).not.toHaveBeenCalled()
  })

  it('после отправки оценки снапшот очищается', async () => {
    const store = useTripsStore()
    completeActiveTrip(store)
    rateTrip.mockResolvedValue({})

    await store.submitRating('trip-finished', 5)

    setActivePinia(createPinia())
    const freshStore = useTripsStore()
    getActiveTrip.mockResolvedValue(null)
    await freshStore.restoreActiveTrip()
    expect(freshStore.activeTrip).toBeNull()
  })
})
