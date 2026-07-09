<script setup lang="ts">
import type { ParkAnalytics, ParkDailyPoint, ParkDriver } from '~/types/park'
import type { StatBucket } from '~/utils/statsChart'
import KpiStatCard from '~/components/app/KpiStatCard.vue'
import StatChartCard from '~/components/charts/StatChartCard.vue'
import { formatRevenue } from '~/utils/format'
import { dayBucketLabels, formatWholeNumber, pluralRu } from '~/utils/statsChart'

// Аналитика кабинета парка: KPI, динамика завершённых поездок за 30 дней
// (барчарт «Поездки/Выручка») и топ водителей. daily === null означает, что
// бэкенд ещё не отдаёт /park/analytics/daily — секция динамики скрывается.
const props = defineProps<{
  analytics: ParkAnalytics | null
  daily: null | ParkDailyPoint[]
  drivers: ParkDriver[]
  loading?: boolean
}>()

const DRIVER_FORMS: [string, string, string] = ['водитель', 'водителя', 'водителей']
const TRIP_FORMS: [string, string, string] = ['поездка', 'поездки', 'поездок']

const METRIC_OPTIONS = [
  { label: 'Поездки', value: 'trips' },
  { label: 'Выручка', value: 'revenue' },
]

const metric = ref('trips')

const chartBuckets = computed<StatBucket[]>(() => (props.daily ?? []).map((point) => {
  const isRevenue = metric.value === 'revenue'
  return {
    ...dayBucketLabels(point.date),
    hint: isRevenue
      ? pluralRu(point.trips, TRIP_FORMS)
      : (point.active_drivers > 0 ? `${pluralRu(point.active_drivers, DRIVER_FORMS)} на линии` : 'без поездок'),
    key: point.date,
    value: isRevenue ? point.revenue : point.trips,
  }
}))

// --- KPI: 30-дневное окно из дневной серии + тоталы за всё время ---

const onlineCount = computed(() => props.drivers.filter(driver => driver.is_online).length)
const trips30 = computed(() => props.daily?.reduce((sum, point) => sum + point.trips, 0) ?? null)
const revenue30 = computed(() => props.daily?.reduce((sum, point) => sum + point.revenue, 0) ?? null)

// Лучший день месяца — по выручке; подсказывает пиковую нагрузку парка.
const bestDay = computed(() => {
  if (!props.daily?.length)
    return null
  const best = props.daily.reduce((acc, point) => point.revenue > acc.revenue ? point : acc)
  return best.revenue > 0 ? best : null
})

const kpiCards = computed(() => {
  const cards = [
    {
      icon: 'i-mdi-steering',
      label: 'Водители',
      sub: `${formatWholeNumber(onlineCount.value)} на линии сейчас`,
      value: formatWholeNumber(props.analytics?.driver_count ?? 0),
    },
    {
      icon: 'i-mdi-map-marker-path',
      label: trips30.value === null ? 'Поездки' : 'Поездки · 30 дней',
      sub: `всего ${pluralRu(props.analytics?.trip_count ?? 0, TRIP_FORMS)}`,
      value: formatWholeNumber(trips30.value ?? props.analytics?.trip_count ?? 0),
    },
    {
      icon: 'i-mdi-cash-multiple',
      label: revenue30.value === null ? 'Выручка' : 'Выручка · 30 дней',
      sub: `всего ${formatRevenue(props.analytics?.total_revenue ?? 0)}`,
      value: formatRevenue(revenue30.value ?? props.analytics?.total_revenue ?? 0),
    },
  ]
  if (bestDay.value) {
    cards.push({
      icon: 'i-mdi-trophy-outline',
      label: 'Лучший день',
      sub: `${dayBucketLabels(bestDay.value.date).fullLabel} · ${pluralRu(bestDay.value.trips, TRIP_FORMS)}`,
      value: formatRevenue(bestDay.value.revenue),
    })
  }
  return cards
})

// --- Топ водителей по числу поездок за всё время ---

const TOP_DRIVERS = 5

const topDrivers = computed(() =>
  [...props.drivers]
    .filter(driver => driver.total_trips > 0)
    .sort((a, b) => b.total_trips - a.total_trips)
    .slice(0, TOP_DRIVERS),
)

const maxDriverTrips = computed(() => Math.max(...topDrivers.value.map(driver => driver.total_trips), 1))
</script>

<template>
  <div class="grid gap-4">
    <div class="grid gap-4 md:grid-cols-2" :class="kpiCards.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'">
      <KpiStatCard
        v-for="card in kpiCards"
        :key="card.label"
        :icon="card.icon"
        :label="card.label"
        :sub="card.sub"
        :value="card.value"
      />
    </div>

    <StatChartCard
      v-if="daily"
      v-model:option="metric"
      :buckets="chartBuckets"
      color="cyan"
      empty-text="За последние 30 дней завершённых поездок не было."
      :format-value="metric === 'revenue' ? formatRevenue : formatWholeNumber"
      :loading="loading && !daily.length"
      :options="METRIC_OPTIONS"
      subtitle="Завершённые поездки парка за 30 дней"
      title="Динамика парка"
      :value-header="metric === 'revenue' ? 'Выручка' : 'Поездки'"
    />

    <section v-if="topDrivers.length" class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
      <h3 class="text-xs text-white/42 font-900 uppercase">
        Топ водителей
      </h3>
      <p class="mt-0.5 text-xs text-white/38">
        По числу поездок за всё время
      </p>

      <ul class="grid mt-4 gap-3">
        <li v-for="driver in topDrivers" :key="driver.id">
          <div class="flex items-baseline justify-between gap-3">
            <RouterLink
              class="truncate text-sm text-cyan-200 font-900 hover:underline"
              :to="`/drivers/${driver.user_id}`"
            >
              {{ driver.name || 'Без имени' }}
            </RouterLink>
            <p class="shrink-0 text-sm text-cyan-100 font-900">
              {{ pluralRu(driver.total_trips, ['поездка', 'поездки', 'поездок']) }}
            </p>
          </div>
          <div aria-hidden="true" class="mt-1.5 h-2 overflow-hidden rounded-full bg-black/24">
            <div
              class="h-full rounded-full bg-cyan-300/70"
              :style="{ width: `${Math.max(4, (driver.total_trips / maxDriverTrips) * 100)}%` }"
            />
          </div>
          <p class="mt-1 text-xs text-white/38">
            <span :class="driver.is_online ? 'text-emerald-300' : ''">{{ driver.is_online ? 'Онлайн' : 'Офлайн' }}</span>
            · рейтинг {{ driver.rating.toFixed(1) }}
          </p>
        </li>
      </ul>
    </section>
  </div>
</template>
