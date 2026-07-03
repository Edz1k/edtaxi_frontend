import { computed, ref } from 'vue'
import { isTelegramWebApp } from '../auth/telegram'
import {
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

export function useLocationAccess() {
  return {
    isGranted: computed(() => status.value === 'granted'),
    isRequesting,
    openSettings,
    requestAccess,
    status,
  }
}
