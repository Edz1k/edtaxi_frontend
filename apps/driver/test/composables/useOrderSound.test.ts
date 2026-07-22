import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useOrderSound } from '~/composables/driver/useOrderSound'
import { useDriverStore } from '~/stores/driver'

// Заглушка HTMLAudioElement: настоящий в jsdom не умеет play().
//
// ⚠️ Она НАРОЧНО не считает muted гарантией тишины — воспроизведение признаётся
// слышимым по одному volume. Так заглушка моделирует не идеальную спецификацию,
// а среду, ради которой писался фикс: в Telegram-вебвью флаг muted, выставленный
// перед play() на ещё не загруженном элементе, иногда терялся, и «беззвучный»
// прогрев звучал на весь салон. Если убрать из прогрева volume = 0, тесты ниже
// покраснеют — ровно этого мы и хотим.
class FakeAudio {
  loop = false
  preload = ''
  muted = false
  volume = 1
  currentTime = 0
  paused = true
  // Разрешения промисов play() держим снаружи: так тест воспроизводит реальную
  // задержку между «начали играть» и «промис отработал» — именно в этом окне
  // прогрев и был слышен. Копим их списком, а не одним полем: во время прогрева
  // может прийти второй play() от настоящего оффера, и потерять первый нельзя.
  pendingPlays: (() => void)[] = []
  // Сколько раз воспроизведение было слышимым. Считаем по volume — см. оговорку
  // про ненадёжный muted в шапке класса.
  audiblePlays = 0

  play() {
    this.paused = false
    if (this.volume > 0)
      this.audiblePlays++

    return new Promise<void>((resolve) => {
      this.pendingPlays.push(resolve)
    })
  }

  pause() {
    this.paused = true
  }

  // settle — «медиа действительно поехало», промисы play() разрешаются.
  async settle() {
    const pending = this.pendingPlays
    this.pendingPlays = []
    pending.forEach(resolve => resolve())
    await nextTick()
    await nextTick()
  }
}

let lastAudio: FakeAudio

function mountSound() {
  const Host = defineComponent({
    setup() {
      useOrderSound()
      return () => h('div')
    },
  })
  return mount(Host)
}

function offer(tripId = 'trip-1') {
  return {
    category: 'economy',
    distance_km: 5,
    dropoff_address: 'Асыл Арман',
    dropoff_lat: 51.128,
    dropoff_lng: 71.412,
    estimated_fare: 1200,
    pickup_address: 'Хан Шатыр',
    pickup_lat: 51.132,
    pickup_lng: 71.402,
    timeout_sec: 20,
    trip_id: tripId,
  } as never
}

describe('мелодия заказа', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.stubGlobal('Audio', class {
      constructor() {
        lastAudio = new FakeAudio()

        return lastAudio as unknown as HTMLAudioElement
      }
    })
  })

  it('прогрев на касании экрана не издаёт звука', async () => {
    mountSound()

    // Любой тап по экрану — вход в приложение, приопускание шторки — запускает
    // разблокировку звука. Слышно при этом быть ничего не должно.
    window.dispatchEvent(new Event('pointerdown'))
    await nextTick()

    expect(lastAudio.muted).toBe(true)
    expect(lastAudio.volume).toBe(0)

    await lastAudio.settle()

    expect(lastAudio.audiblePlays).toBe(0)
    expect(lastAudio.paused).toBe(true)
  })

  it('после прогрева элемент снова слышим', async () => {
    mountSound()
    window.dispatchEvent(new Event('pointerdown'))
    await lastAudio.settle()

    expect(lastAudio.muted).toBe(false)
    expect(lastAudio.volume).toBe(1)
  })

  it('настоящий оффер звучит', async () => {
    mountSound()
    window.dispatchEvent(new Event('pointerdown'))
    await lastAudio.settle()

    const driver = useDriverStore()
    driver.pendingOffer = offer()
    await nextTick()

    expect(lastAudio.audiblePlays).toBe(1)
    expect(lastAudio.paused).toBe(false)
  })

  it('оффер, пришедший во время прогрева, не теряется', async () => {
    mountSound()
    window.dispatchEvent(new Event('pointerdown'))
    await nextTick()

    // Оффер приходит, пока прогрев ещё не завершился: его play() отрабатывает
    // на заглушенном элементе, а pause() прогрева его останавливает. Без
    // до-игровки в прогреве водитель молча пропустил бы заказ.
    const driver = useDriverStore()
    driver.pendingOffer = offer()
    await nextTick()
    expect(lastAudio.audiblePlays).toBe(0)

    await lastAudio.settle()

    expect(lastAudio.audiblePlays).toBe(1)
    expect(lastAudio.paused).toBe(false)
  })

  it('снятие оффера останавливает мелодию', async () => {
    mountSound()
    window.dispatchEvent(new Event('pointerdown'))
    await lastAudio.settle()

    const driver = useDriverStore()
    driver.pendingOffer = offer()
    await nextTick()
    driver.pendingOffer = null
    await nextTick()

    expect(lastAudio.paused).toBe(true)
  })
})
