<script setup lang="ts">
import type { Trip } from '~/types/trips'
import type { EarningsPeriod } from '~/utils/earningsChart'
import EarningsBarChart from '~/components/driver/EarningsBarChart.vue'
import { buildEarningsBuckets, formatTenge, formatTripCount } from '~/utils/earningsChart'

const props = defineProps<{
  trips: Trip[]
  loading?: boolean
  truncated?: boolean
}>()

const PERIOD_OPTIONS: Array<{ value: EarningsPeriod, label: string }> = [
  { label: 'Дни', value: 'day' },
  { label: 'Месяцы', value: 'month' },
  { label: 'Годы', value: 'year' },
]

// Выбранный период переживает перезаходы в приложение.
const period = useLocalStorage<EarningsPeriod>('edtaxi-driver-earnings-period', 'day')

const buckets = computed(() => buildEarningsBuckets(props.trips, period.value))

const selectedIndex = ref(0)

// При смене периода или обновлении данных выбор возвращается на текущий
// (последний) период — то, что водитель ищет чаще всего.
watchImmediate(() => buckets.value.length, (length) => {
  selectedIndex.value = Math.max(0, length - 1)
})

const selectedBucket = computed(() => buckets.value[selectedIndex.value])

const hasCompletedTrips = computed(() => props.trips.length > 0)
const isInitialLoading = computed(() => Boolean(props.loading) && !hasCompletedTrips.value)
</script>

<template>
  <section class="border border-main-500/20 rounded-3xl bg-white/6 p-5">
    <header class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-xs text-slate-400 font-800 uppercase">
          Динамика заработка
        </h2>
        <p class="mt-0.5 text-xs text-slate-500">
          По сумме поездок, до комиссии
        </p>
      </div>

      <div aria-label="Период диаграммы" class="flex shrink-0 rounded-xl bg-secondary-950/70 p-1" role="group">
        <button
          v-for="option in PERIOD_OPTIONS"
          :key="option.value"
          :aria-pressed="period === option.value"
          class="rounded-lg px-2.5 py-1.5 text-xs font-900 transition-colors"
          :class="period === option.value ? 'bg-main-500 text-secondary-950' : 'text-slate-400'"
          type="button"
          @click="period = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </header>

    <div v-if="isInitialLoading" aria-busy="true" aria-label="Загружаем статистику" class="mt-4 h-56 animate-pulse rounded-2xl bg-white/6" />

    <div v-else-if="!hasCompletedTrips" class="mt-4 flex flex-col items-center gap-2 py-10 text-center" role="status">
      <span aria-hidden="true" class="i-mdi-chart-bar text-8 text-slate-500" />
      <p class="text-sm text-slate-400 font-700">
        Пока нет завершённых поездок
      </p>
      <p class="text-xs text-slate-500">
        Диаграмма появится после первой поездки.
      </p>
    </div>

    <template v-else>
      <!-- Readout выбранной корзины: значение — главное, период — подпись -->
      <div aria-live="polite" class="mt-4">
        <p class="text-2xl text-main-200 font-950">
          {{ formatTenge(selectedBucket?.total ?? 0) }}
        </p>
        <p class="mt-0.5 text-xs text-slate-400 font-700">
          {{ selectedBucket?.fullLabel }} · {{ formatTripCount(selectedBucket?.tripCount ?? 0) }}
        </p>
      </div>

      <EarningsBarChart v-model:selected-index="selectedIndex" :buckets="buckets" class="mt-3" />

      <p v-if="truncated" class="mt-2 text-xs text-slate-500">
        Учтены последние 500 поездок.
      </p>
    </template>
  </section>
</template>
