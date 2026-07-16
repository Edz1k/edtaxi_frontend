// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Контроллер держит состояние на уровне модуля (сплэш снимается один раз за
// жизнь страницы), поэтому каждый тест берёт свежий инстанс через resetModules.
async function freshSplash() {
  vi.resetModules()
  return import('../composables/useAppSplash')
}

function mountSplash() {
  document.body.innerHTML = '<div id="app-splash"></div>'
  return document.getElementById('app-splash')!
}

// Уход сплэша анимируется, а удаление из DOM висит на transitionend —
// в jsdom событие само не приходит, шлём вручную.
function fireTransitionEnd(el: Element) {
  el.dispatchEvent(new Event('transitionend'))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('hideAppSplash', () => {
  it('помечает сплэш скрытым и убирает из DOM по окончании анимации', async () => {
    const { hideAppSplash } = await freshSplash()
    const splash = mountSplash()

    hideAppSplash()
    // Сначала только флаг — иначе не будет плавного ухода.
    expect(splash.hasAttribute('data-hidden')).toBe(true)
    expect(document.getElementById('app-splash')).not.toBeNull()

    fireTransitionEnd(splash)
    expect(document.getElementById('app-splash')).toBeNull()
  })

  it('убирает сплэш по страховочному таймауту, если transitionend не пришёл', async () => {
    const { hideAppSplash } = await freshSplash()
    mountSplash()

    hideAppSplash()
    expect(document.getElementById('app-splash')).not.toBeNull()

    vi.advanceTimersByTime(600)
    expect(document.getElementById('app-splash')).toBeNull()
  })

  it('идемпотентен: повторный вызов ничего не ломает', async () => {
    const { hideAppSplash } = await freshSplash()
    const splash = mountSplash()

    hideAppSplash()
    fireTransitionEnd(splash)
    expect(() => hideAppSplash()).not.toThrow()
    expect(document.getElementById('app-splash')).toBeNull()
  })

  it('не падает, когда сплэша в разметке нет', async () => {
    const { hideAppSplash } = await freshSplash()

    expect(() => hideAppSplash()).not.toThrow()
  })
})

describe('armAppSplashFallback', () => {
  it('снимает сплэш по таймауту — на случай, когда гео и карта так и не пришли', async () => {
    const { armAppSplashFallback } = await freshSplash()
    const splash = mountSplash()

    armAppSplashFallback(7000)
    vi.advanceTimersByTime(6999)
    expect(splash.hasAttribute('data-hidden')).toBe(false)

    vi.advanceTimersByTime(1)
    expect(splash.hasAttribute('data-hidden')).toBe(true)
  })

  it('снятие сплэша отменяет предохранитель', async () => {
    const { armAppSplashFallback, hideAppSplash } = await freshSplash()
    const splash = mountSplash()

    armAppSplashFallback(7000)
    hideAppSplash()
    fireTransitionEnd(splash)

    // Предохранитель не должен дёрнуться и «снять» уже снятое.
    expect(() => vi.advanceTimersByTime(7000)).not.toThrow()
    expect(document.getElementById('app-splash')).toBeNull()
  })

  it('не взводится, если сплэш уже снят', async () => {
    const { armAppSplashFallback, hideAppSplash } = await freshSplash()

    hideAppSplash()
    mountSplash()
    armAppSplashFallback(7000)

    // Взвода не было — сплэш, добавленный позже, таймаут не трогает.
    vi.advanceTimersByTime(7000)
    expect(document.getElementById('app-splash')?.hasAttribute('data-hidden')).toBe(false)
  })
})
