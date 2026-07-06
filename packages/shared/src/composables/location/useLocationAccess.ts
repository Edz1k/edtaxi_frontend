import { computed, ref } from 'vue'
import { isTelegramWebApp } from '../auth/telegram'
import {
  isTelegramLocationAccessGranted,
  isTelegramLocationSupported,
  openTelegramLocationSettings,
  requestTelegramLocation,
} from '../telegram/location'

// Глобальный (синглтон на уровне модуля) статус доступа к геолокации — единый
// источник правды для гейта на входе, кнопки «Выйти онлайн» у водителя и
// оформления заказа у пассажира. useUserLocation обновляет его через
// markLocationGranted/markLocationDenied, а гейт сам инициирует запрос.
export type LocationAccessStatus = 'checking' | 'denied' | 'granted' | 'unknown'

const status = ref<LocationAccessStatus>('unknown')
const isRequesting = ref(false)

export function markLocationGranted() {
  status.value = 'granted'
}

export function markLocationDenied() {
  // Не затираем уже полученный доступ разовой ошибкой (например таймаутом) —
  // если раньше координаты приходили, оставляем granted.
  if (status.value !== 'granted')
    status.value = 'denied'
}

function requestBrowserLocation(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 },
    )
  })
}

// requestAccess запрашивает доступ и обновляет статус. В Telegram — через
// нативный LocationManager, иначе — через navigator (первый вызов показывает
// системный промпт). Возвращает true, если доступ есть.
async function requestAccess(): Promise<boolean> {
  if (isRequesting.value)
    return status.value === 'granted'

  isRequesting.value = true
  status.value = 'checking'
  try {
    if (isTelegramWebApp() && isTelegramLocationSupported()) {
      const tg = await requestTelegramLocation()
      status.value = tg ? 'granted' : 'denied'
      return Boolean(tg)
    }

    const ok = await requestBrowserLocation()
    status.value = ok ? 'granted' : 'denied'
    return ok
  }
  finally {
    isRequesting.value = false
  }
}

// openSettings открывает экран согласия Telegram (если он есть), иначе повторно
// запрашивает доступ у браузера. Должен вызываться из пользовательского жеста.
async function openSettings(): Promise<void> {
  if (await openTelegramLocationSettings())
    return
  await requestAccess()
}

// ===== Автодетект выдачи доступа =====
// Раньше пользователь выдавал доступ (в настройках Telegram/системы) и
// возвращался к заглушке, которая требовала ещё раз нажать кнопку. Теперь гейт
// сам замечает выдачу: Permissions API (onchange), возврат вкладки в фокус и
// фоновый поллинг раз в 4с — всё ТИХО, без повторных промптов (getCurrentPosition
// зовём только когда разрешение уже granted).

const AUTO_DETECT_INTERVAL_MS = 4000
let autoDetectStarted = false

async function checkAccessSilently(): Promise<void> {
  if (status.value === 'granted' || isRequesting.value)
    return

  // Telegram: тихий сигнал isAccessGranted; координаты забираем только когда
  // доступ уже есть (иначе requestLocation открыл бы консент-скрин).
  if (isTelegramWebApp() && isTelegramLocationSupported()) {
    if (await isTelegramLocationAccessGranted()) {
      const tg = await requestTelegramLocation()
      if (tg)
        status.value = 'granted'
    }
    return
  }

  // Браузер: без Permissions API тихо проверить нельзя (getCurrentPosition
  // показал бы промпт) — тогда полагаемся на кнопку гейта.
  try {
    const permission = await navigator.permissions?.query({ name: 'geolocation' })
    if (permission?.state === 'granted' && await requestBrowserLocation())
      status.value = 'granted'
  }
  catch {}
}

// startLocationAutoDetect запускается гейтом один раз на приложение.
export function startLocationAutoDetect(): void {
  if (autoDetectStarted || typeof window === 'undefined')
    return
  autoDetectStarted = true

  // Мгновенная реакция на переключение разрешения в браузере.
  try {
    navigator.permissions?.query({ name: 'geolocation' })
      .then((permission) => {
        permission.onchange = () => {
          if (permission.state === 'granted')
            void checkAccessSilently()
        }
      })
      .catch(() => {})
  }
  catch {}

  // Возврат в приложение (из настроек ОС/Telegram) — проверяем сразу.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden)
      void checkAccessSilently()
  })

  // Фоновый поллинг, пока доступа нет; после granted просто no-op (дёшево).
  window.setInterval(() => {
    void checkAccessSilently()
  }, AUTO_DETECT_INTERVAL_MS)
}

export function useLocationAccess() {
  return {
    isGranted: computed(() => status.value === 'granted'),
    isRequesting,
    openSettings,
    requestAccess,
    status,
  }
}
