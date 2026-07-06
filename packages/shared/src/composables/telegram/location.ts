import { locationManager } from '@telegram-apps/sdk'
import { isTelegramWebApp } from '../auth/telegram'
import { initTelegramSdk } from './sdk'

// Внутри Telegram-вебвью браузерный navigator.geolocation после отказа нельзя
// повторно спросить (и на iOS он часто вообще не отдаёт координаты) — поэтому
// геолокацию в мини-аппе берём через нативный Telegram LocationManager: он умеет
// и запрашивать координаты (requestLocation), и открывать экран согласия
// (openSettings). Всё обёрнуто в try/catch и возвращает null/false при любой
// проблеме — чтобы вызывающий код мог откатиться на navigator.geolocation.

export interface TelegramCoords {
  accuracy: number
  heading: number | null
  lat: number
  lng: number
}

export function isTelegramLocationSupported(): boolean {
  try {
    initTelegramSdk()
    return isTelegramWebApp() && locationManager.isSupported()
  }
  catch {
    return false
  }
}

async function ensureMounted(): Promise<boolean> {
  try {
    if (locationManager.isMounted())
      return true

    if (locationManager.mount.isAvailable()) {
      await locationManager.mount()
      return locationManager.isMounted()
    }
  }
  catch {
    // не удалось смонтировать — откат на navigator у вызывающего
  }
  return false
}

// requestTelegramLocation — одноразовый запрос координат через Telegram.
// Возвращает null, если Telegram-локация недоступна или пользователь не дал
// доступ (тогда вызывающий показывает баннер с предложением открыть настройки).
export async function requestTelegramLocation(): Promise<TelegramCoords | null> {
  if (!isTelegramLocationSupported())
    return null
  if (!(await ensureMounted()))
    return null
  if (!locationManager.requestLocation.isAvailable())
    return null

  try {
    // requestLocation типизирован как any (сырой payload Telegram); читаем поля
    // защитно (snake_case из бриджа и возможный camelCase из будущих версий SDK).
    const raw = await locationManager.requestLocation() as Record<string, unknown>
    const lat = Number(raw.latitude ?? raw.lat)
    const lng = Number(raw.longitude ?? raw.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      return null

    const accuracyRaw = Number(raw.horizontal_accuracy ?? raw.horizontalAccuracy)
    const courseRaw = raw.course
    return {
      accuracy: Number.isFinite(accuracyRaw) ? accuracyRaw : 0,
      heading: typeof courseRaw === 'number' ? courseRaw : null,
      lat,
      lng,
    }
  }
  catch {
    return null
  }
}

// isTelegramLocationAccessGranted — тихая проверка, выдал ли пользователь
// доступ к геолокации в Telegram (сигнал isAccessGranted у LocationManager).
// Не показывает никакого UI, поэтому годится для фонового поллинга гейта:
// пока false — requestLocation звать нельзя (он открыл бы консент-скрин).
export async function isTelegramLocationAccessGranted(): Promise<boolean> {
  if (!isTelegramLocationSupported())
    return false
  if (!(await ensureMounted()))
    return false

  try {
    return Boolean(locationManager.isAccessGranted())
  }
  catch {
    return false
  }
}

// openTelegramLocationSettings открывает нативный экран согласия Telegram на
// доступ к геолокации. Должен вызываться из пользовательского жеста (тап по
// баннеру). Возвращает true, если экран удалось открыть.
export async function openTelegramLocationSettings(): Promise<boolean> {
  if (!isTelegramLocationSupported())
    return false
  if (!(await ensureMounted()))
    return false

  try {
    if (locationManager.openSettings.isAvailable()) {
      locationManager.openSettings()
      return true
    }
  }
  catch {
    // openSettings недоступен в этой версии Telegram — откат у вызывающего
  }
  return false
}
