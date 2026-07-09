<script setup lang="ts">
import type { AdminCityStat } from '~/types/admin'
import { formatWholeNumber, pluralRu } from '~/utils/statsChart'

// Топ городов по аудитории: горизонтальные бары с разбивкой на
// пассажиров и водителей.
const props = defineProps<{
  stats: AdminCityStat[]
  loading?: boolean
}>()

const TOP_CITIES = 8

const topCities = computed(() =>
  [...props.stats].sort((a, b) => b.total - a.total).slice(0, TOP_CITIES),
)

const maxTotal = computed(() => Math.max(...topCities.value.map(city => city.total), 1))

function cityHint(city: AdminCityStat) {
  return `${pluralRu(city.passengers, ['пассажир', 'пассажира', 'пассажиров'])} · ${pluralRu(city.drivers, ['водитель', 'водителя', 'водителей'])}`
}
</script>

<template>
  <section class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
    <h3 class="text-xs text-white/42 font-900 uppercase">
      География
    </h3>
    <p class="mt-0.5 text-xs text-white/38">
      Топ городов по числу пользователей
    </p>

    <div v-if="loading" aria-busy="true" class="mt-4 h-56 animate-pulse rounded-2xl bg-white/6" />

    <p v-else-if="!topCities.length" class="mt-4 py-10 text-center text-sm text-white/50 font-700" role="status">
      Пока нет данных по городам.
    </p>

    <ul v-else class="grid mt-4 gap-3 sm:grid-cols-2 sm:gap-x-8">
      <li v-for="city in topCities" :key="city.city">
        <div class="flex items-baseline justify-between gap-3">
          <p class="truncate text-sm font-900">
            {{ city.city }}
          </p>
          <p class="shrink-0 text-sm text-cyan-100 font-900">
            {{ formatWholeNumber(city.total) }}
          </p>
        </div>
        <div aria-hidden="true" class="mt-1.5 h-2 overflow-hidden rounded-full bg-black/24">
          <div
            class="h-full rounded-full bg-cyan-300/70"
            :style="{ width: `${Math.max(4, (city.total / maxTotal) * 100)}%` }"
          />
        </div>
        <p class="mt-1 text-xs text-white/38">
          {{ cityHint(city) }}
        </p>
      </li>
    </ul>
  </section>
</template>
