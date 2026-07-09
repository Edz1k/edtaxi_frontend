<script setup lang="ts">
import type { StatBucket } from '~/utils/statsChart'
import CityStatsCard from '~/components/admin/overview/CityStatsCard.vue'
import KpiStatCard from '~/components/app/KpiStatCard.vue'
import StatChartCard from '~/components/charts/StatChartCard.vue'
import { useAdminStore } from '~/stores/admin'
import { formatRevenue } from '~/utils/format'
import { dayBucketLabels, formatWholeNumber, monthBucketLabels, pluralRu } from '~/utils/statsChart'

// Обзор платформы: KPI-карточки и чарты по данным GET /admin/overview.
// Серии приходят непрерывными (30 дней / 12 месяцев), компонент только
// раскладывает их по корзинам конкретных чартов.
const admin = useAdminStore()

onMounted(() => {
  admin.loadOverview().catch(() => {})
})

// Период серии: 'day' (30 дней) или 'month' (12 месяцев). Тип — string,
// как у модели переключателя StatChartCard.
const PERIOD_OPTIONS = [
  { label: 'Дни', value: 'day' },
  { label: 'Месяцы', value: 'month' },
]

const usersPeriod = ref('day')
const activityPeriod = ref('day')
const tripsPeriod = ref('day')
const revenuePeriod = ref('day')

const DRIVER_FORMS: [string, string, string] = ['водитель', 'водителя', 'водителей']
const PASSENGER_FORMS: [string, string, string] = ['пассажир', 'пассажира', 'пассажиров']
const TRIP_FORMS: [string, string, string] = ['заказ', 'заказа', 'заказов']

interface SeriesPoint {
  key: string
  newUsers: number
  newDrivers: number
  activePassengers: number
  activeDrivers: number
  tripsCompleted: number
  tripsCancelled: number
  revenue: number
}

// Дневная и месячная серии приводятся к одной форме, чтобы корзины чартов
// собирались единообразно независимо от периода.
function seriesFor(period: string): SeriesPoint[] {
  if (!admin.overview)
    return []
  if (period === 'day') {
    return admin.overview.daily.map(point => ({
      activeDrivers: point.active_drivers,
      activePassengers: point.active_passengers,
      key: point.date,
      newDrivers: point.new_drivers,
      newUsers: point.new_users,
      revenue: point.revenue,
      tripsCancelled: point.trips_cancelled,
      tripsCompleted: point.trips_completed,
    }))
  }
  return admin.overview.monthly.map(point => ({
    activeDrivers: point.active_drivers,
    activePassengers: point.active_passengers,
    key: point.month,
    newDrivers: point.new_drivers,
    newUsers: point.new_users,
    revenue: point.revenue,
    tripsCancelled: 0,
    tripsCompleted: point.trips_completed,
  }))
}

function bucketLabels(period: string, key: string) {
  return period === 'day' ? dayBucketLabels(key) : monthBucketLabels(key)
}

function buildBuckets(period: string, value: (point: SeriesPoint) => number, hint?: (point: SeriesPoint) => string): StatBucket[] {
  return seriesFor(period).map(point => ({
    ...bucketLabels(period, point.key),
    hint: hint?.(point),
    key: point.key,
    value: value(point),
  }))
}

const userBuckets = computed(() => buildBuckets(
  usersPeriod.value,
  point => point.newUsers,
  point => point.newDrivers > 0 ? `из них ${pluralRu(point.newDrivers, DRIVER_FORMS)}` : 'без новых водителей',
))

const activityBuckets = computed(() => buildBuckets(
  activityPeriod.value,
  point => point.activePassengers + point.activeDrivers,
  point => `${pluralRu(point.activePassengers, PASSENGER_FORMS)} · ${pluralRu(point.activeDrivers, DRIVER_FORMS)}`,
))

const tripBuckets = computed(() => buildBuckets(
  tripsPeriod.value,
  point => point.tripsCompleted,
  point => tripsPeriod.value === 'day'
    ? (point.tripsCancelled > 0 ? `${pluralRu(point.tripsCancelled, ['отмена', 'отмены', 'отмен'])}` : 'без отмен')
    : `выручка ${formatRevenue(point.revenue)}`,
))

const revenueBuckets = computed(() => buildBuckets(
  revenuePeriod.value,
  point => point.revenue,
  point => pluralRu(point.tripsCompleted, TRIP_FORMS),
))

// --- KPI: тоталы + суммы по 30-дневному окну ---

const totals = computed(() => admin.overview?.totals)

const newUsers30 = computed(() => admin.overview?.daily.reduce((sum, point) => sum + point.new_users, 0) ?? 0)
const trips30 = computed(() => admin.overview?.daily.reduce((sum, point) => sum + point.trips_completed, 0) ?? 0)
const cancelled30 = computed(() => admin.overview?.daily.reduce((sum, point) => sum + point.trips_cancelled, 0) ?? 0)
const revenue30 = computed(() => admin.overview?.daily.reduce((sum, point) => sum + point.revenue, 0) ?? 0)

// MAU текущего месяца — последняя точка месячной серии.
const currentMonth = computed(() => admin.overview?.monthly.at(-1))
const mau = computed(() => (currentMonth.value?.active_passengers ?? 0) + (currentMonth.value?.active_drivers ?? 0))

const kpiCards = computed(() => {
  if (!totals.value)
    return []
  return [
    {
      icon: 'i-mdi-account-group',
      label: 'Пользователи',
      sub: `+${formatWholeNumber(newUsers30.value)} за 30 дней`,
      value: formatWholeNumber(totals.value.users),
    },
    {
      icon: 'i-mdi-steering',
      label: 'Водители',
      sub: `${formatWholeNumber(totals.value.online_drivers)} на линии сейчас`,
      value: formatWholeNumber(totals.value.drivers),
    },
    {
      icon: 'i-mdi-account-heart-outline',
      label: 'MAU',
      sub: 'активные в этом месяце (пассажиры + водители)',
      value: formatWholeNumber(mau.value),
    },
    {
      icon: 'i-mdi-map-marker-path',
      label: 'Заказы · 30 дней',
      sub: cancelled30.value > 0 ? `${pluralRu(cancelled30.value, ['отмена', 'отмены', 'отмен'])}` : 'без отмен',
      value: formatWholeNumber(trips30.value),
    },
    {
      icon: 'i-mdi-cash-multiple',
      label: 'Выручка · 30 дней',
      sub: `всего ${formatRevenue(totals.value.total_revenue)}`,
      value: formatRevenue(revenue30.value),
    },
    {
      icon: 'i-mdi-office-building',
      label: 'Таксопарки',
      sub: 'подтверждённые',
      value: formatWholeNumber(totals.value.approved_parks),
    },
  ]
})

const isInitialLoading = computed(() => admin.isLoadingOverview && !admin.overview)
const hasFailed = computed(() => !admin.isLoadingOverview && !admin.overview)
</script>

<template>
  <section>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-950">
          Обзор платформы
        </h2>
        <p class="mt-1 text-sm text-white/55">
          Аудитория, активность и заказы за последние 30 дней и 12 месяцев.
        </p>
      </div>
      <button
        class="h-10 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-60"
        :disabled="admin.isLoadingOverview"
        type="button"
        @click="admin.loadOverview().catch(() => {})"
      >
        <span class="i-mdi-refresh text-5 text-cyan-200" :class="{ 'animate-spin': admin.isLoadingOverview }" />
        {{ admin.isLoadingOverview ? 'Обновляем...' : 'Обновить' }}
      </button>
    </div>

    <div v-if="isInitialLoading" aria-busy="true" aria-label="Загружаем обзор" class="grid mt-5 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div v-for="index in 6" :key="index" class="h-31 animate-pulse rounded-3xl bg-white/6" />
    </div>

    <div v-else-if="hasFailed" class="mt-5 border border-amber-300/18 rounded-3xl bg-amber-300/8 p-5 text-sm text-white/70">
      Не удалось загрузить обзор. Попробуйте обновить — если не поможет, проверьте, что бэкенд обновлён до версии с /admin/overview.
    </div>

    <template v-else>
      <div class="grid mt-5 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiStatCard
          v-for="card in kpiCards"
          :key="card.label"
          :icon="card.icon"
          :label="card.label"
          :sub="card.sub"
          :value="card.value"
        />
      </div>

      <div class="grid mt-4 gap-4 xl:grid-cols-2">
        <StatChartCard
          v-model:option="usersPeriod"
          :buckets="userBuckets"
          color="cyan"
          empty-text="Пока нет новых регистраций за этот период."
          :options="PERIOD_OPTIONS"
          subtitle="Новые регистрации на платформе"
          title="Привлечённые пользователи"
          value-header="Новые пользователи"
        />
        <StatChartCard
          v-model:option="activityPeriod"
          :buckets="activityBuckets"
          color="emerald"
          empty-text="Пока нет активности за этот период."
          :options="PERIOD_OPTIONS"
          :subtitle="activityPeriod === 'day' ? 'DAU — уникальные участники поездок за день' : 'MAU — уникальные участники поездок за месяц'"
          title="Активность"
          value-header="Активные пользователи"
        />
        <StatChartCard
          v-model:option="tripsPeriod"
          :buckets="tripBuckets"
          color="gold"
          empty-text="Пока нет выполненных заказов за этот период."
          :options="PERIOD_OPTIONS"
          subtitle="Выполненные заказы"
          title="Заказы"
          value-header="Заказы"
        />
        <StatChartCard
          v-model:option="revenuePeriod"
          :buckets="revenueBuckets"
          color="emerald"
          empty-text="Пока нет выручки за этот период."
          :format-value="formatRevenue"
          :options="PERIOD_OPTIONS"
          subtitle="Сумма завершённых заказов, до комиссии"
          title="Выручка"
          value-header="Выручка"
        />
      </div>

      <CityStatsCard class="mt-4" :loading="admin.isLoadingOverview && !admin.cityStats.length" :stats="admin.cityStats" />
    </template>
  </section>
</template>
