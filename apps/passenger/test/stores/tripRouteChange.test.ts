import type { Trip, TripRouteChange } from '~/types/trips'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cancelRouteChange, getPendingRouteChange, getTrip, proposeRouteChange } = vi.hoisted(() => ({
  cancelRouteChange: vi.fn(),
  getPendingRouteChange: vi.fn(),
  getTrip: vi.fn(),
  proposeRouteChange: vi.fn(),
}))

// Стор изолируем от сети и соседей: проверяем только его собственную логику
// вокруг заявки на остановку.
vi.mock('~/api/trips', () => ({
  cancelRouteChange,
  cancelTrip: vi.fn(),
  createTrip: vi.fn(),
  estimateTrip: vi.fn(),
  fileTripComplaint: vi.fn(),
  getActiveTrip: vi.fn(),
  getPendingRouteChange,
  getTrip,
  getTripHistory: vi.fn(),
  proposeRouteChange,
  rateTrip: vi.fn(),
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

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    status: 'in_progress',
    stops: [],
    ...overrides,
  } as Trip
}

function change(overrides: Partial<TripRouteChange> = {}): TripRouteChange {
  return {
    created_at: '2026-07-21T10:00:00Z',
    distance_km: 12.4,
    duration_min: 21,
    fee: 480,
    id: 'change-1',
    status: 'pending',
    trip_id: 'trip-1',
    ...overrides,
  }
}

describe('заявка на остановку в пути', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('добавляет остановку в конец списка, не двигая уже пройденные', async () => {
    const store = useTripsStore()
    store.activeTrip = trip({ stops: [{ address: 'Первая', lat: 51.1, lng: 71.4 }] })
    proposeRouteChange.mockResolvedValue(change())

    await store.proposeTripStop({ address: 'Вторая', lat: 51.2, lng: 71.5 } as never)

    // Порядок принципиален: у водителя пройденные остановки отмечены индексом,
    // и вставка в середину зачеркнула бы не ту точку.
    expect(proposeRouteChange).toHaveBeenCalledWith('trip-1', [
      { address: 'Первая', lat: 51.1, lng: 71.4 },
      { address: 'Вторая', lat: 51.2, lng: 71.5 },
    ])
    expect(store.pendingRouteChange?.fee).toBe(480)
  })

  it('не отправляет заявку, когда остановок уже максимум', async () => {
    const store = useTripsStore()
    store.activeTrip = trip({
      stops: [
        { address: 'Раз', lat: 51.1, lng: 71.4 },
        { address: 'Два', lat: 51.2, lng: 71.4 },
        { address: 'Три', lat: 51.3, lng: 71.4 },
      ],
    })

    await store.proposeTripStop({ address: 'Четвёртая', lat: 51.4, lng: 71.4 } as never)

    expect(proposeRouteChange).not.toHaveBeenCalled()
  })

  it('считает согласием исчезновение заявки, когда остановок в поездке стало больше', async () => {
    const store = useTripsStore()
    store.activeTrip = trip()
    proposeRouteChange.mockResolvedValue(change())
    await store.proposeTripStop({ address: 'Аптека', lat: 51.2, lng: 71.5 } as never)

    // Водитель согласился: заявка закрыта, а маршрут поездки удлинился.
    store.activeTrip = trip({ stops: [{ address: 'Аптека', lat: 51.2, lng: 71.5 }] })
    getPendingRouteChange.mockResolvedValue({ route_change: null })
    await store.refreshPendingRouteChange()

    expect(store.pendingRouteChange).toBeNull()
    expect(store.routeChangeOutcome).toBe('accepted')
  })

  it('считает отказом исчезновение заявки при неизменившемся маршруте', async () => {
    const store = useTripsStore()
    store.activeTrip = trip()
    proposeRouteChange.mockResolvedValue(change())
    await store.proposeTripStop({ address: 'Аптека', lat: 51.2, lng: 71.5 } as never)

    // Водитель отказался: заявка тоже исчезла, но остановок в поездке не прибавилось.
    getPendingRouteChange.mockResolvedValue({ route_change: null })
    await store.refreshPendingRouteChange()

    expect(store.routeChangeOutcome).toBe('rejected')
  })

  it('после отмены пассажиром не показывает «водитель отказался»', async () => {
    const store = useTripsStore()
    store.activeTrip = trip()
    proposeRouteChange.mockResolvedValue(change())
    await store.proposeTripStop({ address: 'Аптека', lat: 51.2, lng: 71.5 } as never)

    cancelRouteChange.mockResolvedValue({ message: 'ok' })
    await store.cancelPendingRouteChange()

    expect(store.pendingRouteChange).toBeNull()
    expect(store.routeChangeOutcome).toBeNull()
  })

  it('не тащит заявку из прошлой поездки в следующую', async () => {
    const store = useTripsStore()
    store.activeTrip = trip()
    proposeRouteChange.mockResolvedValue(change())
    await store.proposeTripStop({ address: 'Аптека', lat: 51.2, lng: 71.5 } as never)

    store.resetActiveTrip()

    expect(store.pendingRouteChange).toBeNull()
    expect(store.routeChangeOutcome).toBeNull()
  })
})
