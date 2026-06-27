<script setup lang="ts">
import type { TripStatus } from '~/types/trips'
import MapView from '~/components/map/MapView.vue'
import { TARIFF_META } from '~/constants/tariffs'
import { useShareStore } from '~/stores/share'

const route = useRoute()
const shareStore = useShareStore()

definePage({
  meta: {
    layout: false,
  },
})

const token = computed(() => {
  const params = route.params as { token?: string | string[] }
  const value = params.token

  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
})
let refreshTimer: number | undefined

const statusMeta: Record<TripStatus, {
  description: string
  icon: string
  tone: string
  title: string
}> = {
  cancelled: {
    description: 'Поездка отменена.',
    icon: 'i-mdi-close-circle',
    tone: 'text-red-300',
    title: 'Поездка отменена',
  },
  completed: {
    description: 'Пассажир уже доехал до точки назначения.',
    icon: 'i-mdi-check-circle',
    tone: 'text-emerald-300',
    title: 'Поездка завершена',
  },
  driver_arriving: {
    description: 'Водитель прибыл к месту посадки.',
    icon: 'i-mdi-map-marker-check',
    tone: 'text-emerald-300',
    title: 'Водитель на месте',
  },
  driver_assigned: {
    description: 'Водитель принял заказ и едет к пассажиру.',
    icon: 'i-mdi-car-clock',
    tone: 'text-main-300',
    title: 'Водитель найден',
  },
  in_progress: {
    description: 'Поездка идет прямо сейчас.',
    icon: 'i-mdi-navigation-variant',
    tone: 'text-main-300',
    title: 'Пассажир в пути',
  },
  searching: {
    description: 'Сервис ищет свободного водителя рядом.',
    icon: 'i-mdi-radar animate-pulse',
    tone: 'text-main-300',
    title: 'Идет поиск водителя',
  },
}

const currentStatus = computed(() => {
  if (!shareStore.trip)
    return null

  if (shareStore.trip.completed_at)
    return statusMeta.completed

  return statusMeta[shareStore.trip.status]
})

const fareText = computed(() => {
  if (!shareStore.trip)
    return ''

  return `${Math.round(shareStore.trip.final_fare ?? shareStore.trip.estimated_fare).toLocaleString('ru-RU')} ₸`
})

const expiresAtText = computed(() => formatDateTime(shareStore.expiresAt))
const startedAtText = computed(() => formatDateTime(shareStore.trip?.started_at ?? ''))
const completedAtText = computed(() => formatDateTime(shareStore.trip?.completed_at ?? ''))

function formatDateTime(value: null | string | undefined) {
  if (!value)
    return ''

  const date = new Date(value)

  if (!Number.isFinite(date.getTime()))
    return ''

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date)
}

function startRefreshPolling() {
  if (typeof window === 'undefined')
    return

  refreshTimer = window.setInterval(() => {
    if (!shareStore.trip || shareStore.isTerminal)
      return

    shareStore.load(token.value, { silent: true }).catch(() => {})
  }, 10_000)
}

function stopRefreshPolling() {
  if (!refreshTimer)
    return

  window.clearInterval(refreshTimer)
  refreshTimer = undefined
}

onMounted(async () => {
  await shareStore.load(token.value)
  startRefreshPolling()
})

onBeforeUnmount(() => {
  stopRefreshPolling()
  shareStore.reset()
})
</script>

<template>
  <main class="min-h-screen bg-secondary-950 text-white">
    <section class="relative min-h-screen overflow-hidden">
      <MapView
        v-if="shareStore.canShowMap"
        :destination-place="shareStore.destinationPlace"
        :pickup-place="shareStore.pickupPlace"
        :route-coordinates="shareStore.routeCoordinates"
        :show-route="shareStore.canShowRoute"
      />

      <div
        v-else
        class="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(230,173,46,0.16),_transparent_34%),linear-gradient(180deg,_#10141a_0%,_#050608_100%)]"
      />

      <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 from-secondary-950 via-secondary-950/88 to-transparent bg-gradient-to-t pt-24" />

      <div class="relative z-20 min-h-screen flex items-end px-4 pb-[calc(var(--app-safe-area-bottom)+1rem)] pt-[calc(var(--app-safe-area-top)+1rem)]">
        <section class="mx-auto max-w-sm w-full border border-white/10 rounded-[2rem] bg-secondary-950/88 p-4 shadow-[0_-18px_54px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
          <div v-if="shareStore.isLoading" class="py-10 text-center">
            <span class="i-mdi-loading mx-auto block animate-spin text-9 text-main-300" />
            <p class="mt-3 text-sm text-slate-300 font-800">
              Загружаем поездку...
            </p>
          </div>

          <div v-else-if="shareStore.isMissing" class="py-10 text-center">
            <span class="i-mdi-link-off mx-auto block text-10 text-red-300" />
            <h1 class="mt-4 text-xl font-950">
              Ссылка недоступна
            </h1>
            <p class="mt-2 text-sm text-slate-400 font-700">
              Ссылка не найдена или срок действия истек.
            </p>
          </div>

          <div v-else-if="shareStore.errorMessage" class="py-10 text-center">
            <span class="i-mdi-alert-circle mx-auto block text-10 text-amber-300" />
            <h1 class="mt-4 text-xl font-950">
              Не удалось открыть поездку
            </h1>
            <p class="mt-2 text-sm text-slate-400 font-700">
              {{ shareStore.errorMessage }}
            </p>
            <button
              class="mt-5 h-12 w-full rounded-[1.35rem] bg-main-500 text-sm font-950 transition active:scale-[0.98]"
              type="button"
              @click="shareStore.load(token)"
            >
              Повторить
            </button>
          </div>

          <div v-else-if="shareStore.trip && currentStatus">
            <div class="flex items-start gap-3">
              <div class="h-14 w-14 flex shrink-0 items-center justify-center rounded-full bg-main-500/18" :class="currentStatus.tone">
                <span class="text-7" :class="currentStatus.icon" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h1 class="truncate text-xl font-950">
                    {{ currentStatus.title }}
                  </h1>
                  <span v-if="shareStore.isRefreshing" class="i-mdi-loading shrink-0 animate-spin text-4 text-slate-500" />
                </div>
                <p class="mt-1 text-sm text-slate-400 font-700">
                  {{ currentStatus.description }}
                </p>
              </div>
            </div>

            <div class="mt-4 rounded-[1.35rem] bg-white/5 p-3 space-y-3">
              <div class="flex gap-3">
                <span class="mt-0.5 h-6 w-6 flex shrink-0 items-center justify-center rounded-full bg-main-500 text-xs text-white font-950">A</span>
                <div class="min-w-0">
                  <p class="text-xs text-slate-500 font-800 uppercase">
                    Откуда
                  </p>
                  <p class="mt-0.5 text-sm font-800 leading-5">
                    {{ shareStore.trip.pickup_address }}
                  </p>
                </div>
              </div>

              <div class="flex gap-3">
                <span class="mt-0.5 h-6 w-6 flex shrink-0 items-center justify-center rounded-full bg-red-500 text-xs text-white font-950">B</span>
                <div class="min-w-0">
                  <p class="text-xs text-slate-500 font-800 uppercase">
                    Куда
                  </p>
                  <p class="mt-0.5 text-sm font-800 leading-5">
                    {{ shareStore.trip.dropoff_address }}
                  </p>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 mt-4 gap-2 text-left">
              <div class="rounded-[1.15rem] bg-white/5 px-3 py-2.5">
                <p class="text-xs text-slate-500 font-800">
                  Тариф
                </p>
                <p class="mt-1 text-sm font-900">
                  {{ TARIFF_META[shareStore.trip.category].label }}
                </p>
              </div>

              <div class="rounded-[1.15rem] bg-white/5 px-3 py-2.5">
                <p class="text-xs text-slate-500 font-800">
                  Стоимость
                </p>
                <p class="mt-1 text-sm font-900">
                  {{ fareText }}
                </p>
              </div>

              <div v-if="startedAtText" class="rounded-[1.15rem] bg-white/5 px-3 py-2.5">
                <p class="text-xs text-slate-500 font-800">
                  Началась
                </p>
                <p class="mt-1 text-sm font-900">
                  {{ startedAtText }}
                </p>
              </div>

              <div v-if="completedAtText" class="rounded-[1.15rem] bg-white/5 px-3 py-2.5">
                <p class="text-xs text-slate-500 font-800">
                  Завершена
                </p>
                <p class="mt-1 text-sm font-900">
                  {{ completedAtText }}
                </p>
              </div>
            </div>

            <div class="mt-4 flex items-center justify-between rounded-[1.15rem] bg-white/5 px-3 py-2.5 text-xs text-slate-400 font-800">
              <span>Просмотров: {{ shareStore.viewCount }}</span>
              <span v-if="expiresAtText">До {{ expiresAtText }}</span>
            </div>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
