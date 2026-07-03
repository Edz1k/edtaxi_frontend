import type { GeoPlace } from '../../types/geocoding'
import { onBeforeUnmount, ref } from 'vue'
import { reverseGeocodePlace } from '../../api/geocoding'
import { isTelegramWebApp } from '../auth/telegram'
import { markLocationDenied, markLocationGranted } from '../location/useLocationAccess'
import {
  isTelegramLocationSupported,
  openTelegramLocationSettings,
  requestTelegramLocation,
} from '../telegram/location'
import { useToast } from '../useToast'

export interface UserCoordinates {
  accuracy: number
  heading: number | null
  lat: number
  lng: number
}

const LAST_KNOWN_LOCATION_KEY = 'edtaxi:last-known-location'

// loadCachedLocation читает последнюю успешно полученную геопозицию из
// localStorage — используется как начальный центр карты вместо захардкоженного
// города, чтобы при открытии приложения карта не "пролетала" через всю страну
// от дефолтного центра к настоящему местоположению пользователя.
export function loadCachedLocation(): [number, number] | null {
  try {
    const raw = localStorage.getItem(LAST_KNOWN_LOCATION_KEY)
    if (!raw)
      return null

    const parsed = JSON.parse(raw) as { lat?: number, lng?: number }
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number')
      return null

    return [parsed.lng, parsed.lat]
  }
  catch {
    return null
  }
}

function saveCachedLocation(lat: number, lng: number) {
  try {
    localStorage.setItem(LAST_KNOWN_LOCATION_KEY, JSON.stringify({ lat, lng }))
  }
  catch {
    // localStorage недоступен (приватный режим/квота) — не критично, просто
    // следующий запуск снова стартует с дефолтного центра.
  }
}

function getCurrentPosition(options?: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Геолокация недоступна в этом браузере.'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

function getGeolocationErrorMessage(error: unknown) {
  if (!(error instanceof GeolocationPositionError))
    return error instanceof Error ? error.message : 'Не удалось получить геопозицию.'

  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Разрешите доступ к геолокации.'
    case error.POSITION_UNAVAILABLE:
      return 'Геопозиция сейчас недоступна.'
    case error.TIMEOUT:
      return 'Не удалось получить геопозицию за отведенное время.'
    default:
      return 'Не удалось получить геопозицию.'
  }
}

export function useUserLocation() {
  const toast = useToast()
  const isLocating = ref(false)
  const liveCoordinates = ref<UserCoordinates | null>(null)
  const locationError = ref('')

  let watchID: number | undefined
  // Telegram LocationManager отдаёт координаты только по одноразовому запросу
  // (watch, как у navigator, нет) — поэтому непрерывное отслеживание в мини-аппе
  // делаем поллингом requestLocation по таймеру.
  let tgWatchTimer: ReturnType<typeof setInterval> | undefined
  let locationToastID: number | undefined

  // Нажимной баннер «Геолокация недоступна»: тап открывает экран согласия. Не
  // дублируем, пока он на экране; после успеха убираем; после того как юзер его
  // закрыл — снова покажем при следующей неудаче (настойчивое напоминание).
  function locationToastVisible() {
    return locationToastID !== undefined && toast.toasts.value.some(t => t.id === locationToastID)
  }

  function showLocationErrorToast(message: string) {
    if (locationToastVisible())
      return

    locationToastID = toast.warning(
      'Геолокация недоступна',
      `${message} Нажмите, чтобы разрешить.`,
      { onClick: () => { void openLocationSettings() } },
    )
  }

  function clearLocationErrorToast() {
    if (locationToastID !== undefined) {
      toast.removeToast(locationToastID)
      locationToastID = undefined
    }
  }

  function saveUserCoordinates(coords: UserCoordinates) {
    liveCoordinates.value = coords
    saveCachedLocation(coords.lat, coords.lng)
    locationError.value = ''
    clearLocationErrorToast()
    markLocationGranted()
  }

  function coordsFromPosition(position: GeolocationPosition): UserCoordinates {
    return {
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    }
  }

  // getCoordinates берёт геопозицию из Telegram LocationManager (если внутри
  // мини-аппа), иначе — из navigator.geolocation. В Telegram navigator после
  // отказа переспросить нельзя, а нативный менеджер умеет открыть экран согласия.
  async function getCoordinates(options?: PositionOptions): Promise<UserCoordinates> {
    if (isTelegramWebApp()) {
      const tg = await requestTelegramLocation()
      if (tg)
        return tg
    }

    const position = await getCurrentPosition(options)
    return coordsFromPosition(position)
  }

  async function locateUser() {
    isLocating.value = true
    locationError.value = ''

    try {
      const coords = await getCoordinates({
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 10_000,
      })

      saveUserCoordinates(coords)

      // GPS-координаты уже получены — даже если reverse geocoding
      // (запрос адреса по координатам) не отработает, это не должно
      // выглядеть как "геолокация недоступна". Используем сырые координаты
      // как запасной вариант, чтобы пользователь не остался без точки.
      try {
        return await reverseGeocodePlace(coords.lng, coords.lat)
      }
      catch {
        const fallback: GeoPlace = {
          address: 'Текущее местоположение',
          id: `${coords.lat}:${coords.lng}`,
          lat: coords.lat,
          lng: coords.lng,
          name: 'Текущее местоположение',
        }
        return fallback
      }
    }
    catch (error) {
      locationError.value = getGeolocationErrorMessage(error)
      showLocationErrorToast(locationError.value)
      markLocationDenied()
      throw error
    }
    finally {
      isLocating.value = false
    }
  }

  // openLocationSettings вызывается по тапу на баннер. В Telegram открывает
  // нативный экран согласия; вне Telegram — пробует заново запросить геопозицию
  // у браузера (сработает, если доступ ещё не запрашивали).
  async function openLocationSettings() {
    if (await openTelegramLocationSettings())
      return

    try {
      await locateUser()
    }
    catch {
      // навигатор всё ещё отказывает — баннер уже показан пользователю
    }
  }

  async function pollTelegramLocationOnce() {
    const tg = await requestTelegramLocation()
    if (tg) {
      saveUserCoordinates(tg)
    }
    else {
      showLocationErrorToast('Разрешите доступ к геолокации.')
      markLocationDenied()
    }
  }

  function startWatchingUserLocation() {
    // Telegram-мини-апп: поллим нативный менеджер (watchPosition тут не работает).
    if (isTelegramWebApp() && isTelegramLocationSupported()) {
      if (tgWatchTimer !== undefined)
        return

      void pollTelegramLocationOnce()
      tgWatchTimer = setInterval(() => void pollTelegramLocationOnce(), 5_000)
      return
    }

    if (!navigator.geolocation || watchID !== undefined)
      return

    watchID = navigator.geolocation.watchPosition(
      position => saveUserCoordinates(coordsFromPosition(position)),
      (error) => {
        locationError.value = getGeolocationErrorMessage(error)
        showLocationErrorToast(locationError.value)
        markLocationDenied()
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    )
  }

  function stopWatchingUserLocation() {
    if (tgWatchTimer !== undefined) {
      clearInterval(tgWatchTimer)
      tgWatchTimer = undefined
    }
    if (watchID !== undefined) {
      navigator.geolocation.clearWatch(watchID)
      watchID = undefined
    }
  }

  onBeforeUnmount(stopWatchingUserLocation)

  return {
    isLocating,
    liveCoordinates,
    locateUser,
    locationError,
    openLocationSettings,
    startWatchingUserLocation,
    stopWatchingUserLocation,
  }
}
