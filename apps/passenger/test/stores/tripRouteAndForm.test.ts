import type { Trip } from '~/types/trips'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const { cancelTrip, clearRouteDraft, getActiveTrip, getDrivingRouteVia, saveRouteDraft } = vi.hoisted(() => ({
  cancelTrip: vi.fn(),
  clearRouteDraft: vi.fn(),
  getActiveTrip: vi.fn(),
  getDrivingRouteVia: vi.fn(),
  saveRouteDraft: vi.fn(),
}))

vi.mock('@edtaxi/shared/api/geocoding', () => ({ getDrivingRouteVia }))
vi.mock('~/api/trips', () => ({
  cancelRouteChange: vi.fn(),
  cancelTrip,
  createTrip: vi.fn(),
  estimateTrip: vi.fn(),
  fileTripComplaint: vi.fn(),
  getActiveTrip,
  getPendingRouteChange: vi.fn(() => Promise.resolve(null)),
  getTrip: vi.fn(),
  getTripHistory: vi.fn(),
  proposeRouteChange: vi.fn(),
  rateTrip: vi.fn(),
  retryTripPrepay: vi.fn(),
}))
vi.mock('~/api/pickupHints', () => ({ getPickupHints: vi.fn() }))
vi.mock('~/api/tariffs', () => ({ getTariffCategories: vi.fn() }))
vi.mock('~/api/errors', () => ({
  getUserErrorMessage: vi.fn(() => 'error'),
  showErrorToast: vi.fn(() => 'error'),
}))
vi.mock('~/composables/useToast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}))
// routeDraft мокаем, но следим за вызовами: порядок очистки — часть контракта.
vi.mock('~/utils/routeDraft', () => ({
  clearRouteDraft,
  readRouteDraft: vi.fn(() => null),
  saveRouteDraft,
}))

const { useTripsStore } = await import('~/stores/trips')

function activeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    driver: { name: 'Водитель', rating: 5 },
    dropoff_address: 'Б',
    dropoff_lat: 51.2,
    dropoff_lng: 71.5,
    estimated_fare: 1000,
    id: 'trip-1',
    pickup_address: 'А',
    pickup_lat: 51.1,
    pickup_lng: 71.4,
    status: 'in_progress',
    stops: [],
    ...overrides,
  } as unknown as Trip
}

// Линия маршрута рисуется из routeCoordinates, а заполнял его только
// планировщик заказа: после перезапуска мини-аппа и после принятой остановки
// карта оставалась без маршрута.
describe('маршрут идущей поездки', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    getDrivingRouteVia.mockResolvedValue({ distance_km: 5, duration_min: 10, geometry: [[71.4, 51.1], [71.45, 51.15], [71.5, 51.2]] })
  })

  it('восстановление поездки подтягивает геометрию маршрута', async () => {
    const store = useTripsStore()
    getActiveTrip.mockResolvedValue(activeTrip())

    await store.restoreActiveTrip()
    await vi.waitFor(() => expect(store.routeCoordinates.length).toBe(3))

    expect(getDrivingRouteVia).toHaveBeenCalledWith([
      { lat: 51.1, lng: 71.4 },
      { lat: 51.2, lng: 71.5 },
    ])
  })

  it('принятая остановка перестраивает маршрут через неё', async () => {
    const store = useTripsStore()
    getActiveTrip.mockResolvedValue(activeTrip())
    await store.restoreActiveTrip()
    await vi.waitFor(() => expect(getDrivingRouteVia).toHaveBeenCalledTimes(1))

    // Водитель согласился заехать — в поездке появилась остановка.
    getActiveTrip.mockResolvedValue(activeTrip({
      stops: [{ address: 'Стоп', lat: 51.15, lng: 71.45 }],
    } as Partial<Trip>))
    await store.restoreActiveTrip()

    await vi.waitFor(() => expect(getDrivingRouteVia).toHaveBeenCalledTimes(2))
    expect(getDrivingRouteVia).toHaveBeenLastCalledWith([
      { lat: 51.1, lng: 71.4 },
      { lat: 51.15, lng: 71.45 },
      { lat: 51.2, lng: 71.5 },
    ])
  })

  it('маршрут не перезапрашивается, пока поездка не изменилась', async () => {
    const store = useTripsStore()
    getActiveTrip.mockResolvedValue(activeTrip())

    await store.restoreActiveTrip()
    await vi.waitFor(() => expect(getDrivingRouteVia).toHaveBeenCalledTimes(1))
    // Поллинг/WS обновляют ту же поездку — платный запрос повторять незачем.
    await store.restoreActiveTrip()
    await store.restoreActiveTrip()

    expect(getDrivingRouteVia).toHaveBeenCalledTimes(1)
  })

  it('провайдер не ответил — рисуем прямую через все точки', async () => {
    const store = useTripsStore()
    getActiveTrip.mockResolvedValue(activeTrip())
    getDrivingRouteVia.mockRejectedValue(new Error('provider down'))

    await store.restoreActiveTrip()

    // Без линии MapView не рисует и пины А/Б — пустая карта хуже грубой прямой.
    await vi.waitFor(() => expect(store.routeCoordinates).toEqual([[71.4, 51.1], [71.5, 51.2]]))
  })
})

// Решение владельца: новый заказ всегда начинается с чистой формы.
describe('сброс формы заказа', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    getDrivingRouteVia.mockResolvedValue({ distance_km: 5, duration_min: 10, geometry: [[71.4, 51.1], [71.5, 51.2]] })
  })

  it('clearOrderForm чистит адреса, остановки и черновик', async () => {
    const store = useTripsStore()
    store.setPickupPlace({ address: 'А', id: 'a', lat: 51.1, lng: 71.4, name: 'А' })
    store.setDestinationPlace({ address: 'Б', id: 'b', lat: 51.2, lng: 71.5, name: 'Б' })
    store.setStops([{ address: 'Стоп', id: 's', lat: 51.15, lng: 71.45, name: 'Стоп' }])

    await store.clearOrderForm()

    expect(store.pickup).toBe('')
    expect(store.destination).toBe('')
    expect(store.pickupPlace).toBeNull()
    expect(store.destinationPlace).toBeNull()
    expect(store.stops).toEqual([])
    expect(clearRouteDraft).toHaveBeenCalled()
  })

  // Гонка: вотчер-персист пропускает запись, пока есть активная поездка, и
  // оживает после её завершения — если очистить черновик до его прогона,
  // он тут же запишет старые адреса обратно.
  it('черновик остаётся пустым после отработки вотчера-персиста', async () => {
    const store = useTripsStore()
    store.setPickupPlace({ address: 'А', id: 'a', lat: 51.1, lng: 71.4, name: 'А' })
    store.setDestinationPlace({ address: 'Б', id: 'b', lat: 51.2, lng: 71.5, name: 'Б' })

    await store.clearOrderForm()
    saveRouteDraft.mockClear()
    await nextTick()

    const savedNonEmpty = saveRouteDraft.mock.calls.some(([draft]) =>
      Boolean(draft?.pickup || draft?.destination || draft?.pickupPlace || draft?.destinationPlace),
    )
    expect(savedNonEmpty).toBe(false)
  })

  it('своя отмена поездки возвращает чистую форму', async () => {
    const store = useTripsStore()
    getActiveTrip.mockResolvedValue(activeTrip({ status: 'searching' } as Partial<Trip>))
    await store.restoreActiveTrip()
    // Адреса пришли из поездки (syncRouteDraftFromTrip).
    expect(store.pickup).toBe('А')

    await store.cancelActiveTrip()
    await nextTick()

    expect(store.pickup).toBe('')
    expect(store.destination).toBe('')
    expect(store.stops).toEqual([])
    expect(store.activeTrip).toBeNull()
  })
})
