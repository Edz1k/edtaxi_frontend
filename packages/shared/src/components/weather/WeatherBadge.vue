<script setup lang="ts">
import type { WeatherResult } from '../../api/weather'
import { computed } from 'vue'

const props = defineProps<{
  weather: null | WeatherResult
}>()

// WMO weather code Open-Meteo → иконка: 0 ясно, 1-3 облачно, 45/48 туман,
// 51-67 дождь, 71-77 снег, 80-82 ливень, 85-86 снегопад, 95+ гроза.
const icon = computed(() => {
  const code = props.weather?.weather_code ?? 0
  if (code === 0)
    return 'i-mdi-weather-sunny'
  if (code <= 3)
    return 'i-mdi-weather-partly-cloudy'
  if (code === 45 || code === 48)
    return 'i-mdi-weather-fog'
  if (code <= 67)
    return 'i-mdi-weather-rainy'
  if (code <= 77)
    return 'i-mdi-weather-snowy'
  if (code <= 82)
    return 'i-mdi-weather-pouring'
  if (code <= 86)
    return 'i-mdi-weather-snowy-heavy'
  return 'i-mdi-weather-lightning'
})

const tempText = computed(() => {
  if (!props.weather)
    return ''
  const t = Math.round(props.weather.temp_c)
  return `${t > 0 ? '+' : ''}${t}°`
})
</script>

<template>
  <span
    v-if="weather"
    class="inline-flex shrink-0 items-center gap-1 rounded-full app-chip px-2 py-1 text-xs text-white font-800"
    :title="weather.city"
  >
    <span :class="icon" class="text-4 app-accent" aria-hidden="true" />
    {{ tempText }}
  </span>
</template>
