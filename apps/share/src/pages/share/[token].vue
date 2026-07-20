<script setup lang="ts">
import type { TripStatus } from '~/types/trips'
import { hasWebgl2 } from '@edtaxi/shared/composables/mapbox/webgl'
import { mediaUrl } from '~/api/client'
import ShareTripMap from '~/components/map/ShareTripMap.vue'
import StaticTripMap from '~/components/map/StaticTripMap.vue'
import { tariffLabel } from '~/constants/tariffs'
import { useShareStore } from '~/stores/share'

const route = useRoute()
const shareStore = useShareStore()

// Интерактивная mapbox-gl v3 требует WebGL2. В части мобильных браузеров его нет
// (или выключено аппаратное ускорение) — там карта раньше молча падала чёрным
// экраном. В таком окружении показываем статичную карту (PNG, без WebGL).
// Страница — чистое SPA, так что проба безопасна прямо в setup.
const mapUnavailable = ref(!hasWebgl2())

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

// Статус, которого нет в справочнике (awaiting_payment, любой будущий), не
// должен обнулять всю карточку: тело шаблона висит на currentStatus, и при
// undefined страница показывала пустой прямоугольник — ни данных, ни ошибки, ни
// загрузки. Лучше нейтральная заглушка: адреса и машина всё равно есть.
const UNKNOWN_STATUS = {
  description: 'Отслеживаем поездку.',
  icon: 'i-mdi-map-marker-path',
  title: 'Поездка',
  tone: 'text-slate-300',
}

const currentStatus = computed(() => {
  if (!shareStore.trip)
    return null

  if (shareStore.trip.completed_at)
    return statusMeta.completed

  return statusMeta[shareStore.trip.status] ?? UNKNOWN_STATUS
})

const fareText = computed(() => {
  if (!shareStore.trip)
    return ''

  return `${Math.round(shareStore.trip.final_fare ?? shareStore.trip.estimated_fare).toLocaleString('ru-RU')} ₸`
})

const expiresAtText = computed(() => formatDateTime(shareStore.expiresAt))
const startedAtText = computed(() => formatDateTime(shareStore.trip?.started_at ?? ''))
const completedAtText = computed(() => formatDateTime(shareStore.trip?.completed_at ?? ''))

const driver = computed(() => shareStore.trip?.driver ?? null)

// ETA для получателя ссылки: до посадки — «водитель приедет через ~N мин»,
// в пути — «прибытие через ~N мин». Значение считает бэкенд, страница
// обновляет его поллингом раз в 10 секунд.
const etaText = computed(() => {
  const eta = shareStore.driverEtaSeconds
  const status = shareStore.trip?.status
  if (!eta || !status)
    return ''

  const minutes = Math.max(1, Math.round(eta / 60))
  if (status === 'driver_assigned')
    return `Водитель приедет через ~${minutes} мин`
  if (status === 'in_progress')
    return `Прибытие через ~${minutes} мин`
  return ''
})

// Устаревание геопозиции машины: возраст точки с бэка (age_sec) + время с
// момента ответа. Если точка старше порога — честно говорим об этом вместо
// машинки, застывшей как будто водитель стоит.
const LOCATION_STALE_AFTER_SEC = 15
const nowForStale = useNow({ interval: 1000 })
const staleLocationText = computed(() => {
  const base = shareStore.driverLocationAgeBaseSec
  const fetchedAt = shareStore.driverLocationFetchedAt
  if (base == null || fetchedAt == null || !shareStore.driverLocation)
    return ''

  const sec = base + Math.max(0, Math.floor((nowForStale.value.getTime() - fetchedAt) / 1000))
  if (sec < LOCATION_STALE_AFTER_SEC)
    return ''

  return sec < 60
    ? `Геопозиция машины обновлялась ${sec} сек назад`
    : `Геопозиция машины обновлялась ${Math.floor(sec / 60)} мин назад`
})

// Фактическое время пути для завершённой поездки.
const durationText = computed(() => {
  const trip = shareStore.trip
  if (!trip?.started_at || !trip.completed_at)
    return ''

  const ms = new Date(trip.completed_at).getTime() - new Date(trip.started_at).getTime()
  if (!Number.isFinite(ms) || ms <= 0)
    return ''

  const totalMinutes = Math.max(1, Math.round(ms / 60000))
  if (totalMinutes < 60)
    return `${totalMinutes} мин`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`
})

const driverCategory = computed(() =>
  driver.value?.vehicle?.category ?? shareStore.trip?.category ?? null,
)

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

  // Живое отслеживание: позиция машины на бэке обновляется каждые ~2 сек
  // (Redis), поэтому опрашиваем часто — маркер двигается почти в реальном
  // времени. Для завершённых поездок опрос прекращается.
  refreshTimer = window.setInterval(() => {
    if (!shareStore.trip || shareStore.isTerminal)
      return

    shareStore.load(token.value, { silent: true }).catch(() => {})
  }, 4_000)
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
      <ShareTripMap
        v-if="shareStore.canShowMap && !mapUnavailable"
        :destination-place="shareStore.destinationPlace"
        :driver-category="driverCategory"
        :driver-location="shareStore.driverLocation"
        :pickup-place="shareStore.pickupPlace"
        :route-coordinates="shareStore.routeCoordinates"
        :show-route="shareStore.canShowRoute"
      />

      <!-- Фолбэк без WebGL2: статичная карта вместо чёрного экрана. -->
      <StaticTripMap
        v-else-if="shareStore.canShowMap"
        :destination="shareStore.destinationPlace"
        :driver-location="shareStore.driverLocation"
        :pickup="shareStore.pickupPlace"
      />

      <div
        v-else
        class="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(230,173,46,0.16),_transparent_34%),linear-gradient(180deg,_#10141a_0%,_#050608_100%)]"
      />

      <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 from-secondary-950 via-secondary-950/88 to-transparent bg-gradient-to-t pt-24" />

      <!-- pointer-events-none на обёртке + pointer-events-auto на карточке —
           тот же приём, что в пассажирском даунбаре и водительской панели. Без
           него этот полноэкранный блок перехватывал ВСЕ жесты над карточкой:
           карту нельзя было ни двигать, ни зумить, а кнопка возврата камеры
           внутри карты не нажималась вовсе. -->
      <div class="pointer-events-none relative z-20 min-h-screen flex items-end px-4 pb-[calc(var(--app-safe-area-bottom)+1rem)] pt-[calc(var(--app-safe-area-top)+1rem)]">
        <!-- max-h + overflow-y-auto: у карточки нет сворачивания, и на полном
             наборе (водитель, адреса, плитки, SOS, просмотры) она перерастала
             экран, утаскивая карту вверх. Теперь длинный контент скроллится
             внутри себя. -->
        <section class="pointer-events-auto mx-auto max-h-[calc(100vh-var(--app-safe-area-top)-var(--app-safe-area-bottom)-2rem)] max-w-sm w-full overflow-y-auto border border-white/10 rounded-[2rem] bg-secondary-950/88 p-4 shadow-[0_-18px_54px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
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

            <!-- Живой ETA -->
            <div v-if="etaText" class="mt-3 inline-flex items-center gap-2 rounded-full bg-main-500/14 px-4 py-1.5">
              <span class="i-mdi-clock-fast text-4 text-main-300" aria-hidden="true" />
              <span class="text-sm text-main-200 font-950 tabular-nums">{{ etaText }}</span>
            </div>

            <!-- Геопозиция машины устарела -->
            <div v-if="staleLocationText" class="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-500/12 px-4 py-1.5">
              <span class="i-mdi-map-marker-alert-outline text-4 text-amber-300" aria-hidden="true" />
              <span class="text-xs text-amber-200 font-800 tabular-nums">{{ staleLocationText }}</span>
            </div>

            <!-- Карточка водителя: имя, рейтинг, машина и номер -->
            <div v-if="driver" class="mt-4 flex items-center gap-3 rounded-[1.35rem] bg-white/5 px-3 py-3">
              <div class="h-13 w-13 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                <img v-if="driver.avatar_url" alt="" class="h-full w-full object-cover" :src="mediaUrl(driver.avatar_url)">
                <span v-else class="i-mdi-account text-7 text-slate-400" aria-hidden="true" />
              </div>

              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-1.5 truncate text-sm font-900">
                  {{ driver.name || 'Водитель' }}
                  <span class="shrink-0 text-xs text-amber-300 font-800">★ {{ driver.rating.toFixed(1) }}</span>
                </p>
                <p v-if="driver.vehicle" class="mt-0.5 truncate text-xs text-slate-400 font-700">
                  {{ driver.vehicle.make }} {{ driver.vehicle.model }} · {{ driver.vehicle.color }}
                </p>
                <p v-if="driver.vehicle" class="mt-0.5 inline-block rounded-md bg-white/10 px-2 py-0.5 text-xs font-900 tracking-wide">
                  {{ driver.vehicle.plate_number }}
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
                  {{ tariffLabel(shareStore.trip.category) }}
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

              <div v-if="durationText" class="rounded-[1.15rem] bg-white/5 px-3 py-2.5">
                <p class="text-xs text-slate-500 font-800">
                  Время пути
                </p>
                <p class="mt-1 text-sm font-900">
                  {{ durationText }}
                </p>
              </div>
            </div>

            <!-- Кнопка паники: мгновенный звонок в экстренные службы -->
            <a
              class="mt-4 h-13 w-full flex items-center justify-center gap-2 rounded-[1.35rem] bg-red-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(239,68,68,0.3)] transition active:scale-[0.98]"
              href="tel:112"
            >
              <span class="i-mdi-alarm-light text-5" aria-hidden="true" />
              SOS — позвонить 112
            </a>

            <div class="mt-3 flex items-center justify-between rounded-[1.15rem] bg-white/5 px-3 py-2.5 text-xs text-slate-400 font-800">
              <span>Просмотров: {{ shareStore.viewCount }}</span>
              <span v-if="expiresAtText">До {{ expiresAtText }}</span>
            </div>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
