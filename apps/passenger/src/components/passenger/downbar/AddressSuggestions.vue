<script setup lang="ts">
import type { GeoPlace } from '@edtaxi/shared/types/geocoding'

defineProps<{
  color: 'amber' | 'emerald' | 'red'
  // failed — геокодер недоступен (2ГИС + Mapbox легли): показываем подсказку
  // вместо молчаливо пустого списка.
  failed?: boolean
  isLoading: boolean
  places: GeoPlace[]
}>()

const emit = defineEmits<{
  select: [place: GeoPlace]
}>()
const { locale, t } = useI18n()

// Цвет кружка-иконки подсказки: точка А — изумрудный, остановки — янтарный,
// точка Б — красный.
const iconColorClass = {
  amber: 'bg-amber-400/14 text-amber-300',
  emerald: 'bg-emerald-400/14 text-emerald-300',
  red: 'bg-red-500/14 text-red-300',
} as const

function getSuggestionIcon(place: GeoPlace) {
  if (place.isFavorite)
    return 'i-mdi-star'
  return place.name.toLowerCase().includes('аэропорт') ? 'i-mdi-airplane' : 'i-mdi-map-marker-outline'
}

// «974 км» рядом с подсказкой — чтобы адрес из другого города был заметен
// и пассажир случайно не заказал поездку за тысячу километров.
function formatDistance(m?: null | number) {
  if (m == null)
    return ''
  if (m < 1000)
    return t('addr.m', { n: m })
  if (m < 10_000)
    return t('addr.km', { n: (m / 1000).toLocaleString(locale.value, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) })
  return t('addr.km', { n: Math.round(m / 1000) })
}
</script>

<template>
  <!-- Список сам не скроллится: прокрутку даёт родительский контейнер
       (скролл-область AddressForm или страницы избранного). -->
  <div
    v-if="places.length || isLoading || failed"
    class="min-w-0 overflow-x-hidden rounded-2xl app-card p-2 space-y-1"
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
        :class="place.isFavorite ? 'bg-main-500/16 app-accent' : iconColorClass[color]"
      >
        <span :class="getSuggestionIcon(place)" class="text-5" />
      </span>
      <span class="min-w-0 flex-1 overflow-hidden">
        <span class="block truncate text-sm font-800">{{ place.name }}</span>
        <span class="block truncate text-xs app-muted">{{ place.address }}</span>
      </span>
      <span
        v-if="formatDistance(place.distanceM)"
        class="shrink-0 text-xs app-muted font-700"
      >
        {{ formatDistance(place.distanceM) }}
      </span>
    </button>

    <p
      v-if="isLoading && !places.length"
      class="px-2 py-2 text-xs app-muted font-700"
    >
      {{ t('addr.searching') }}
    </p>

    <p
      v-else-if="failed && !places.length"
      class="px-2 py-2 text-xs text-amber-300/80 font-700 leading-4"
    >
      {{ t('addr.degraded') }}
    </p>
  </div>
</template>
