import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const { refreshActiveTrip } = vi.hoisted(() => ({ refreshActiveTrip: vi.fn(() => Promise.resolve(null)) }))

// Стор подменяем целиком: тест про поведение сокета, а не про поездку.
vi.mock('~/stores/trips', () => ({
  useTripsStore: () => ({
    applyTripStatus: vi.fn(),
    refreshActiveTrip,
    setDriverLocation: vi.fn(),
  }),
}))
vi.mock('~/composables/useToast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}))
vi.mock('~/api/client', () => ({ buildWsUrl: (path: string) => `ws://test${path}` }))

// Минимальный сокет-двойник: сам ничего не открывает, всё дёргает тест.
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static readonly OPEN = 1
  static readonly CONNECTING = 0

  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  readyState = 0
  closeCalls = 0

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  open() {
    this.readyState = 1
    this.onopen?.()
  }

  // Обрыв со стороны сети: сокет мёртв, композабл должен планировать реконнект.
  drop() {
    this.readyState = 3
    this.onclose?.()
  }

  close() {
    this.closeCalls++
    this.readyState = 3
    this.onclose?.()
  }
}

const { usePassengerTripSocket } = await import('~/composables/passenger/usePassengerTripSocket')

// Композабл использует onMounted/onBeforeUnmount — поднимаем его внутри
// настоящего компонента, иначе хуки жизненного цикла не отработают.
async function mountSocket(tripId = 'trip-1') {
  const { defineComponent, h } = await import('vue')
  const { mount } = await import('@vue/test-utils')

  const component = defineComponent({
    setup() {
      usePassengerTripSocket(ref(tripId))
      return () => h('div')
    },
  })
  return mount(component)
}

describe('usePassengerTripSocket', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('не сдаётся после нескольких обрывов подряд', async () => {
    await mountSocket()
    expect(FakeWebSocket.instances).toHaveLength(1)

    // Пять обрывов подряд — старый код бросал попытки после третьего и
    // оставлял пассажира на одном поллинге до конца поездки.
    for (let i = 0; i < 5; i++) {
      FakeWebSocket.instances.at(-1)!.drop()
      await vi.advanceTimersByTimeAsync(60_000)
    }

    expect(FakeWebSocket.instances.length).toBeGreaterThan(5)
  })

  it('увеличивает паузу между попытками', async () => {
    await mountSocket()

    FakeWebSocket.instances.at(-1)!.drop()
    // Первая пауза — около 1.5 с даже с джиттером вниз: за 900 мс никто
    // переподключиться не успевает.
    await vi.advanceTimersByTimeAsync(900)
    const afterFirst = FakeWebSocket.instances.length
    await vi.advanceTimersByTimeAsync(2_000)
    expect(FakeWebSocket.instances.length).toBeGreaterThan(afterFirst)

    // Разгоняем бэкофф несколькими обрывами и проверяем, что пауза выросла:
    // на четвёртой попытке база уже 12 с, и за 2 с реконнекта быть не должно.
    for (let i = 0; i < 3; i++) {
      FakeWebSocket.instances.at(-1)!.drop()
      await vi.advanceTimersByTimeAsync(60_000)
    }
    FakeWebSocket.instances.at(-1)!.drop()
    const beforeWait = FakeWebSocket.instances.length
    await vi.advanceTimersByTimeAsync(2_000)

    expect(FakeWebSocket.instances).toHaveLength(beforeWait)
  })

  it('после реконнекта перечитывает поездку', async () => {
    await mountSocket()

    // Первый коннект ресинка не требует: стор только что загрузил поездку.
    FakeWebSocket.instances.at(-1)!.open()
    expect(refreshActiveTrip).not.toHaveBeenCalled()

    FakeWebSocket.instances.at(-1)!.drop()
    await vi.advanceTimersByTimeAsync(5_000)
    FakeWebSocket.instances.at(-1)!.open()

    // Пока сокет лежал, trip_status мог прийти и пропасть навсегда — без
    // перечитывания пассажир смотрел бы на устаревший статус до тика поллинга.
    expect(refreshActiveTrip).toHaveBeenCalledTimes(1)
  })

  it('не реконнектится после намеренного закрытия', async () => {
    const wrapper = await mountSocket()
    const count = FakeWebSocket.instances.length

    // Размонтирование = уход с экрана: восстанавливать связь не надо.
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(FakeWebSocket.instances).toHaveLength(count)
  })

  it('переподключается сразу при возврате сети, не дожидаясь паузы', async () => {
    await mountSocket()

    FakeWebSocket.instances.at(-1)!.drop()
    // Разгоняем бэкофф, чтобы следующая пауза была заведомо длинной.
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(60_000)
      FakeWebSocket.instances.at(-1)!.drop()
    }

    const beforeOnline = FakeWebSocket.instances.length
    window.dispatchEvent(new Event('online'))

    // Без слушателя вернувшийся из фона пассажир ждал бы хвост бэкоффа до 30 с.
    expect(FakeWebSocket.instances.length).toBeGreaterThan(beforeOnline)
  })
})
