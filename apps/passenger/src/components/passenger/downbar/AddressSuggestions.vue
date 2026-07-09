<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'

defineProps<{
  color: 'emerald' | 'red'
  isLoading: boolean
  places: GeoPlace[]
}>()

const emit = defineEmits<{
  select: [place: GeoPlace]
}>()

function getSuggestionIcon(place: GeoPlace) {
  return place.name.toLowerCase().includes('аэропорт') ? 'i-mdi-airplane' : 'i-mdi-map-marker-outline'
}

// «974 км» рядом с подсказкой — чтобы адрес из другого города был заметен
// и пассажир случайно не заказал поездку за тысячу километров.
function formatDistance(m?: null | number) {
  if (m == null)
    return ''
  if (m < 1000)
    return `${m} м`
  if (m < 10_000)
    return `${(m / 1000).toFixed(1).replace('.', ',')} км`
  return `${Math.round(m / 1000)} км`
}
</script>

<template>
  <!-- Список сам не скроллится: прокрутку даёт родительский контейнер
       (скролл-область AddressForm или страницы избранного). -->
  <div
    v-if="places.length || isLoading"
    class="min-w-0 overflow-x-hidden rounded-2xl bg-white/5 p-2 space-y-1"
  >
    <button
      v-for="place in places"
      :key="place.id"
      class="min-h-11 min-w-0 w-full flex items-center gap-3 overflow-hidden rounded-xl px-2 text-left transition active:scale-[0.98]"
      type="button"
      @click="emit('select', place)"
    >
      <span
        class="h-8 w-8 flex shrink-0 items-center justify-center rounded-full"
        :class="color === 'emerald' ? 'bg-emerald-400/14 text-emerald-300' : 'bg-red-500/14 text-red-300'"
      >
        <span :class="getSuggestionIcon(place)" class="text-5" />
      </span>
      <span class="min-w-0 flex-1 overflow-hidden">
        <span class="block truncate text-sm font-800">{{ place.name }}</span>
        <span class="block truncate text-xs text-slate-400">{{ place.address }}</span>
      </span>
      <span
        v-if="formatDistance(place.distanceM)"
        class="shrink-0 text-xs text-slate-400 font-700"
      >
        {{ formatDistance(place.distanceM) }}
      </span>
    </button>

    <p
      v-if="isLoading && !places.length"
      class="px-2 py-2 text-xs text-slate-400 font-700"
    >
      Ищем адрес...
    </p>
  </div>
</template>
