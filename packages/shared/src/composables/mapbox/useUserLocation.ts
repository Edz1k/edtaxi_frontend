import type { GeoPlace } from '../../types/geocoding'
import { onBeforeUnmount, ref } from 'vue'
import { reverseGeocodePlace } from '../../api/geocoding'
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

  function saveCoordinates(position: GeolocationPosition) {
    liveCoordinates.value = {
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    }
    saveCachedLocation(position.coords.latitude, position.coords.longitude)
  }

  async function locateUser() {
    isLocating.value = true
    locationError.value = ''

    try {
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 10_000,
      })

      saveCoordinates(position)

      // GPS-координаты уже получены — даже если reverse geocoding
      // (запрос адреса по координатам) не отработает, это не должно
      // выглядеть как "геолокация недоступна". Используем сырые координаты
      // как запасной вариант, чтобы пользователь не остался без точки.
      try {
        return await reverseGeocodePlace(
          position.coords.longitude,
          position.coords.latitude,
        )
      }
      catch {
        const fallback: GeoPlace = {
          address: 'Текущее местоположение',
          id: `${position.coords.latitude}:${position.coords.longitude}`,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: 'Текущее местоположение',
        }
        return fallback
      }
    }
    catch (error) {
      locationError.value = getGeolocationErrorMessage(error)
      toast.warning('Геолокация недоступна', locationError.value)
      throw error
    }
    finally {
      isLocating.value = false
    }
  }

  function startWatchingUserLocation() {
    if (!navigator.geolocation || watchID !== undefined)
      return

    watchID = navigator.geolocation.watchPosition(
      saveCoordinates,
      (error) => {
        locationError.value = getGeolocationErrorMessage(error)
        toast.warning('Геолокация недоступна', locationError.value)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    )
  }

  function stopWatchingUserLocation() {
    if (watchID === undefined)
      return

    navigator.geolocation.clearWatch(watchID)
    watchID = undefined
  }

  onBeforeUnmount(stopWatchingUserLocation)

  return {
    isLocating,
    liveCoordinates,
    locateUser,
    locationError,
    startWatchingUserLocation,
    stopWatchingUserLocation,
  }
}
