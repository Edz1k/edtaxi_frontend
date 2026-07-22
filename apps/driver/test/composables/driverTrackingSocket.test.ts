import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { refreshActiveTrip } = vi.hoisted(() => ({ refreshActiveTrip: vi.fn(() => Promise.resolve(null)) }))

// Стор подменяем целиком: тест про поведение сокета, а не про поездку.
vi.mock('~/stores/driver', () => ({
  useDriverStore: () => ({
    applyTripStatus: vi.fn(),
    expireOffer: vi.fn(() => false),
    receiveOffer: vi.fn(),
    refreshActiveTrip,
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
  sent: string[] = []

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
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

const { useDriverTrackingSocket } = await import('~/composables/driver/useDriverTrackingSocket')

// Композабл использует onMounted/onBeforeUnmount — поднимаем его внутри
// настоящего компонента, иначе хуки жизненного цикла не отработают.
async function mountSocket() {
  const { defineComponent, h } = await import('vue')
  const { mount } = await import('@vue/test-utils')

  let api: ReturnType<typeof useDriverTrackingSocket> | null = null
  const component = defineComponent({
    setup() {
      api = useDriverTrackingSocket()
      return () => h('div')
    },
  })
  const wrapper = mount(component)
  return { api: api!, wrapper }
}

describe('useDriverTrackingSocket', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    // Геолокация не участвует в этих проверках, но композабл её трогает.
    vi.stubGlobal('navigator', {
      geolocation: { clearWatch: vi.fn(), watchPosition: vi.fn(() => 1) },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('не сдаётся после нескольких обрывов подряд', async () => {
    const { api } = await mountSocket()
    api.connect()
    expect(FakeWebSocket.instances).toHaveLength(1)

    // Пять обрывов подряд. Прежняя реализация (vueuse, retries: 3) после
    // третьего умирала навсегда: водитель возвращался из фона к неработающему
    // трекингу — позиция не уходила, офферы не приходили.
    for (let i = 0; i < 5; i++) {
      FakeWebSocket.instances.at(-1)!.drop()
      await vi.advanceTimersByTimeAsync(60_000)
    }

    expect(FakeWebSocket.instances.length).toBeGreaterThan(5)
  })

  it('увеличивает паузу между попытками', async () => {
    const { api } = await mountSocket()
    api.connect()

    FakeWebSocket.instances.at(-1)!.drop()
    // Первая пауза — около 1.5 с даже с джиттером вниз.
    await vi.advanceTimersByTimeAsync(900)
    const afterFirst = FakeWebSocket.instances.length
    await vi.advanceTimersByTimeAsync(2_000)
    expect(FakeWebSocket.instances.length).toBeGreaterThan(afterFirst)

    for (let i = 0; i < 3; i++) {
      FakeWebSocket.instances.at(-1)!.drop()
      await vi.advanceTimersByTimeAsync(60_000)
    }
    FakeWebSocket.instances.at(-1)!.drop()
    const beforeWait = FakeWebSocket.instances.length
    await vi.advanceTimersByTimeAsync(2_000)

    expect(FakeWebSocket.instances).toHaveLength(beforeWait)
  })

  it('после реконнекта перечитывает активную поездку', async () => {
    const { api } = await mountSocket()
    api.connect()

    FakeWebSocket.instances.at(-1)!.open()
    expect(refreshActiveTrip).not.toHaveBeenCalled()

    FakeWebSocket.instances.at(-1)!.drop()
    await vi.advanceTimersByTimeAsync(5_000)
    FakeWebSocket.instances.at(-1)!.open()

    // Пока сокет лежал, оффер и смена статуса могли пропасть навсегда — хаб
    // не ретранслирует пропущенное.
    expect(refreshActiveTrip).toHaveBeenCalledTimes(1)
  })

  it('возврат из фона: перечитывает поездку даже когда сокет числится живым', async () => {
    const { api } = await mountSocket()
    api.connect()
    FakeWebSocket.instances.at(-1)!.open()

    // Замороженный вебвью оставляет readyState=OPEN на мёртвом соединении:
    // переподключаться формально незачем, но состояние уже устарело.
    document.dispatchEvent(new Event('visibilitychange'))

    expect(refreshActiveTrip).toHaveBeenCalled()
  })

  it('переподключается сразу при возврате сети, не дожидаясь паузы', async () => {
    const { api } = await mountSocket()
    api.connect()

    FakeWebSocket.instances.at(-1)!.drop()
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(60_000)
      FakeWebSocket.instances.at(-1)!.drop()
    }

    const beforeOnline = FakeWebSocket.instances.length
    window.dispatchEvent(new Event('online'))

    expect(FakeWebSocket.instances.length).toBeGreaterThan(beforeOnline)
  })

  it('после ухода с линии не переподключается', async () => {
    const { api } = await mountSocket()
    api.connect()
    FakeWebSocket.instances.at(-1)!.open()

    api.close()
    const afterClose = FakeWebSocket.instances.length

    // Ни бэкофф, ни возврат из фона не должны поднимать сокет обратно:
    // водитель осознанно ушёл в оффлайн.
    await vi.advanceTimersByTimeAsync(60_000)
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(60_000)

    expect(FakeWebSocket.instances).toHaveLength(afterClose)
  })
})
