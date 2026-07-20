import type { DriverTripOffer } from '~/types/websocket'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDriverStore } from '~/stores/driver'

// Стор трогает сеть и тосты только в экшенах, которые здесь не вызываются, но
// импортируются на верхнем уровне — глушим, чтобы тест остался про логику оффера.
vi.mock('~/api/driver', () => ({
  acceptDriverParkInvite: vi.fn(),
  acceptDriverTrip: vi.fn(),
  activateHomeMode: vi.fn(),
  cancelDriverTrip: vi.fn(),
  completeDriverTrip: vi.fn(),
  createDriverProfile: vi.fn(),
  deactivateHomeMode: vi.fn(),
  getActiveDriverTrip: vi.fn(),
  getDriverCategories: vi.fn(),
  getDriverDistricts: vi.fn(),
  getHomeMode: vi.fn(),
  markDriverArrived: vi.fn(),
  rejectDriverTrip: vi.fn(),
  setDriverCategories: vi.fn(),
  setDriverDistricts: vi.fn(),
  startDriverTrip: vi.fn(),
  updateDriverStatus: vi.fn(),
}))
vi.mock('~/api/errors', () => ({
  getUserErrorMessage: vi.fn(() => ''),
  showErrorToast: vi.fn(() => ''),
}))
vi.mock('@edtaxi/shared/composables/useToast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}))

function offer(patch: Partial<DriverTripOffer> = {}): DriverTripOffer {
  return {
    distance_km: 5.2,
    dropoff_address: 'ул. Сатпаева 5',
    estimated_fare: 1500,
    pickup_address: 'ул. Абая 1',
    timeout_sec: 15,
    trip_id: 'trip-1',
    ...patch,
  } as DriverTripOffer
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('входящий оффер', () => {
  it('показывается, когда водитель свободен', () => {
    const driver = useDriverStore()

    driver.receiveOffer(offer())

    expect(driver.pendingOffer?.trip_id).toBe('trip-1')
  })

  // Диспетчер занятого не выбирает, но между отбором кандидатов и отправкой
  // есть окно, и WS-сообщение может догнать уже после принятия другого заказа.
  // Без гарда поверх активной поездки всплывает чужой заказ с мелодией.
  it('не показывается во время активной поездки', () => {
    const driver = useDriverStore()
    driver.currentTripId = 'trip-in-progress'

    driver.receiveOffer(offer({ trip_id: 'trip-2' }))

    expect(driver.pendingOffer).toBeNull()
  })

  // У мелодии loop=true: без клиентского таймера потерянный trip_offer_expired
  // оставлял бы модалку и музыку навсегда.
  it('сам гаснет по timeout_sec, если сервер молчит', () => {
    const driver = useDriverStore()
    driver.receiveOffer(offer({ timeout_sec: 15 }))

    vi.advanceTimersByTime(15_000)
    expect(driver.pendingOffer).not.toBeNull()

    vi.advanceTimersByTime(1_500)
    expect(driver.pendingOffer).toBeNull()
  })

  it('таймер прошлого оффера не гасит следующий', () => {
    const driver = useDriverStore()

    driver.receiveOffer(offer({ timeout_sec: 15, trip_id: 'trip-1' }))
    vi.advanceTimersByTime(10_000)
    driver.receiveOffer(offer({ timeout_sec: 15, trip_id: 'trip-2' }))

    // Момент, когда истёк бы первый оффер, — второй должен остаться.
    vi.advanceTimersByTime(6_500)
    expect(driver.pendingOffer?.trip_id).toBe('trip-2')
  })

  it('закрытие оффера снимает таймер', () => {
    const driver = useDriverStore()
    driver.receiveOffer(offer({ timeout_sec: 15 }))
    driver.clearOffer()

    driver.receiveOffer(offer({ timeout_sec: 60, trip_id: 'trip-3' }))
    vi.advanceTimersByTime(16_500)

    expect(driver.pendingOffer?.trip_id).toBe('trip-3')
  })

  it('оффер без внятного timeout_sec живёт до сигнала сервера', () => {
    const driver = useDriverStore()

    driver.receiveOffer(offer({ timeout_sec: 0 }))
    vi.advanceTimersByTime(120_000)

    expect(driver.pendingOffer).not.toBeNull()
  })
})
