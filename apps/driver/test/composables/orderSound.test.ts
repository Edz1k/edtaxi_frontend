import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

const mocked = vi.hoisted(() => ({ driver: null as null | {
  hasActiveTrip: boolean
  pendingOffer: null | { trip_id: string }
} }))

vi.mock('~/stores/driver', async () => {
  const { reactive } = await import('vue')
  mocked.driver = reactive({ hasActiveTrip: false, pendingOffer: null })
  return { useDriverStore: () => mocked.driver }
})

vi.mock('@vueuse/core', () => ({ useLocalStorage: () => ref(true) }))

interface PlaySnapshot {
  muted: boolean
  volume: number
}

class FakeAudio {
  static instances: FakeAudio[] = []
  static nextPlay: Promise<void> | null = null

  currentTime = 0
  loop = false
  muted = false
  paused = true
  preload = ''
  volume = 1
  pauseCalls = 0
  playSnapshots: PlaySnapshot[] = []

  constructor(_url: string) {
    FakeAudio.instances.push(this)
  }

  play() {
    this.paused = false
    this.playSnapshots.push({ muted: this.muted, volume: this.volume })
    const result = FakeAudio.nextPlay ?? Promise.resolve()
    FakeAudio.nextPlay = null
    return result
  }

  pause() {
    this.paused = true
    this.pauseCalls++
  }
}

const { useOrderSound } = await import('~/composables/driver/useOrderSound')

function mountOrderSound() {
  return mount(defineComponent({
    setup() {
      useOrderSound()
      return () => h('div')
    },
  }))
}

async function flush() {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}

describe('мелодия входящего заказа', () => {
  beforeEach(() => {
    FakeAudio.instances = []
    FakeAudio.nextPlay = null
    vi.stubGlobal('Audio', FakeAudio)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('не запускается от скролла/тапа и играет один раз только для нового ID оффера', async () => {
    const wrapper = mountOrderSound()

    // Первый жест только бесшумно прогревает media element.
    window.dispatchEvent(new Event('pointerdown'))
    await flush()
    const audio = FakeAudio.instances[0]
    expect(audio.playSnapshots).toEqual([{ muted: true, volume: 0 }])

    window.dispatchEvent(new Event('pointerdown'))
    await flush()
    expect(audio.playSnapshots).toHaveLength(1)

    mocked.driver!.pendingOffer = { trip_id: 'trip-1' }
    await flush()
    expect(audio.playSnapshots.at(-1)).toEqual({ muted: false, volume: 1 })
    expect(audio.playSnapshots).toHaveLength(2)

    // Касания даунбара и повторная запись того же заказа звук не перезапускают.
    window.dispatchEvent(new Event('pointerdown'))
    mocked.driver!.pendingOffer = { trip_id: 'trip-1' }
    await flush()
    expect(audio.playSnapshots).toHaveLength(2)

    mocked.driver!.pendingOffer = null
    await flush()
    window.dispatchEvent(new Event('pointerdown'))
    await flush()
    expect(audio.playSnapshots).toHaveLength(2)

    wrapper.unmount()
  })

  it('гасит отложенный play, если оффер исчез до его разрешения', async () => {
    const wrapper = mountOrderSound()
    window.dispatchEvent(new Event('pointerdown'))
    await flush()

    let resolvePlay!: () => void
    FakeAudio.nextPlay = new Promise<void>((resolve) => {
      resolvePlay = resolve
    })

    mocked.driver!.pendingOffer = { trip_id: 'trip-delayed' }
    await nextTick()
    const audio = FakeAudio.instances[0]
    mocked.driver!.pendingOffer = null
    await flush()
    const pausesAfterClose = audio.pauseCalls

    resolvePlay()
    await flush()

    expect(audio.paused).toBe(true)
    expect(audio.pauseCalls).toBeGreaterThan(pausesAfterClose)
    wrapper.unmount()
  })
})
