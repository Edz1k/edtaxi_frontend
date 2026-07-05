import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { resolveMyCity } from '../api/city'

// Расстояние, после которого город резолвится заново (уехал в другой город).
const RE_RESOLVE_DISTANCE_KM = 30

interface Coords {
  lat: number
  lng: number
}

// useUserCity определяет город пользователя по живым координатам: один запрос,
// когда координаты появились, и повторный — только если уехали дальше
// RE_RESOLVE_DISTANCE_KM от точки последнего резолва. Бэкенд заодно сохраняет
// город в профиле (фильтры/статистика по городам в админке).
export function useUserCity(coordinates: Ref<Coords | null>, initial = '') {
  const city = ref(initial)
  let resolvedAt: Coords | null = null
  let inFlight = false

  watch(coordinates, async (coords) => {
    if (!coords || inFlight)
      return
    if (resolvedAt && haversineKM(coords, resolvedAt) < RE_RESOLVE_DISTANCE_KM)
      return

    inFlight = true
    try {
      const response = await resolveMyCity(coords.lat, coords.lng)
      resolvedAt = { lat: coords.lat, lng: coords.lng }
      if (response.city)
        city.value = response.city
    }
    catch {
      // сеть/бэк недоступны — покажем город из сессии (initial) или ничего
    }
    finally {
      inFlight = false
    }
  }, { immediate: true })

  return { city }
}

function haversineKM(a: Coords, b: Coords) {
  const toRad = (deg: number) => deg * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
