import type { Ref } from 'vue'
import type { WeatherResult } from '../api/weather'
import { onBeforeUnmount, ref, watch } from 'vue'
import { getWeather } from '../api/weather'

// Кэш на бэке — 10 минут на город; фронт обновляет с тем же периодом и при
// первом появлении координат. Best-effort: ошибки глотаются, виджет прячется.
const REFRESH_MS = 10 * 60 * 1000

export function useWeather(coordinates: Ref<null | { lat: number, lng: number }>) {
  const weather = ref<null | WeatherResult>(null)
  let timer: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    const point = coordinates.value
    if (!point)
      return
    try {
      const result = await getWeather(point.lat, point.lng)
      weather.value = result.available ? result : null
    }
    catch {
      weather.value = null
    }
  }

  watch(coordinates, (point, prev) => {
    // Первые координаты — сразу тянем погоду и заводим таймер.
    if (point && !prev)
      refresh()
  }, { immediate: true })

  timer = setInterval(refresh, REFRESH_MS)
  onBeforeUnmount(() => {
    if (timer)
      clearInterval(timer)
  })

  return { refresh, weather }
}
