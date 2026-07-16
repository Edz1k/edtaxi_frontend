// Стартовый экран (#app-splash из index.html). Снимается не по mount, а когда
// приложение реально готово к работе: на карте — когда она отрисована и
// отработал стартовый сценарий (профиль, геопозиция); на остальных экранах
// ждать нечего, поэтому там сплэш уходит сразу (см. App.vue каждого приложения).
//
// Держать сплэш до готовности можно ТОЛЬКО с жёстким предохранителем: гео может
// не прийти никогда (отказ, подвал, забытый диалог разрешений), карта — не
// загрузиться при пустом токене или мёртвой сети. Зависший стартовый экран
// выглядит как сломанное приложение, поэтому по таймауту снимаем безусловно.
const FALLBACK_MS = 7000

let isHidden = false
let fallbackTimer: number | undefined

export function hideAppSplash() {
  if (isHidden)
    return

  isHidden = true
  if (fallbackTimer)
    clearTimeout(fallbackTimer)

  const splash = document.getElementById('app-splash')
  if (!splash)
    return

  splash.setAttribute('data-hidden', '')
  splash.addEventListener('transitionend', () => splash.remove(), { once: true })
  // Страховка: transitionend может не прийти (прерванный переход, вкладка в фоне).
  setTimeout(() => splash.remove(), 600)
}

// armAppSplashFallback — предохранитель от вечного сплэша. Вызывается один раз
// после монтирования; любой hideAppSplash() его снимает.
export function armAppSplashFallback(ms = FALLBACK_MS) {
  if (isHidden)
    return

  fallbackTimer = window.setTimeout(hideAppSplash, ms)
}
