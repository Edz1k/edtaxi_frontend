<script setup lang="ts">
import type { Trip, TripStatus } from '~/types/trips'
import { useToast } from '~/composables/useToast'
import { formatFare, TARIFF_META } from '~/constants/tariffs'
import { useSupportStore } from '~/stores/support'
import { useTripsStore } from '~/stores/trips'

const trips = useTripsStore()
const support = useSupportStore()
const router = useRouter()
const toast = useToast()
const attachingTripId = ref<string | null>(null)

async function contactSupport(trip: Trip) {
  if (attachingTripId.value)
    return
  attachingTripId.value = trip.id
  try {
    await support.attachTrip(trip.id, 'passenger')
    await router.push('/menu/support')
  }
  catch {
    toast.error('Ошибка', 'Не удалось открыть поддержку по поездке.')
  }
  finally {
    attachingTripId.value = null
  }
}
const scrollRoot = ref<HTMLElement | null>(null)
const loadMoreSentinel = ref<HTMLElement | null>(null)
const ratingTrip = ref<Trip | null>(null)
const ratingScore = ref(5)
const ratingComment = ref('')
let observer: IntersectionObserver | undefined

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'История поездок',
  },
})

useHead({
  title: 'История поездок | EdTaxi',
})

const statusMeta: Record<TripStatus, { className: string, label: string }> = {
  cancelled: {
    className: 'bg-red-500/12 text-red-300',
    label: 'Отменена',
  },
  completed: {
    className: 'bg-emerald-500/12 text-emerald-300',
    label: 'Завершена',
  },
  driver_arriving: {
    className: 'bg-main-500/12 text-main-300',
    label: 'Водитель на месте',
  },
  driver_assigned: {
    className: 'bg-main-500/12 text-main-300',
    label: 'Водитель назначен',
  },
  in_progress: {
    className: 'bg-amber-500/12 text-amber-300',
    label: 'В пути',
  },
  searching: {
    className: 'bg-slate-500/14 text-slate-300',
    label: 'Поиск',
  },
}

const isInitialLoading = computed(() => trips.isLoadingHistory && !trips.history.length)
const isListEmpty = computed(() => !trips.isLoadingHistory && !trips.history.length)

function getTripDate(trip: Trip) {
  if (!trip.created_at)
    return 'Дата не указана'

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
  }).format(new Date(trip.created_at))
}

function getTripFare(trip: Trip) {
  return formatFare({
    category: trip.category,
    distance_km: trip.distance_km,
    duration_min: trip.duration_min,
    estimated_fare: trip.final_fare ?? trip.estimated_fare,
    surge_multiplier: trip.surge_multiplier,
  })
}

function getTripMeta(trip: Trip) {
  const distance = `${trip.distance_km.toFixed(1)} км`
  const duration = `${Math.round(trip.duration_min)} мин`
  const tariff = TARIFF_META[trip.category].label

  return `${tariff} · ${distance} · ${duration}`
}

async function refreshHistory() {
  trips.resetHistory()
  await trips.loadHistory(20, 0)
}

async function loadMoreHistory() {
  await trips.loadMoreHistory(20)
}

function openRating(trip: Trip) {
  ratingTrip.value = trip
  ratingScore.value = 5
  ratingComment.value = ''
}

function closeRating() {
  ratingTrip.value = null
  ratingComment.value = ''
}

async function submitRating() {
  if (!ratingTrip.value)
    return

  await trips.submitRating(ratingTrip.value.id, ratingScore.value, ratingComment.value)
  toast.success('Спасибо', 'Оценка отправлена.')
  closeRating()
}

function setupInfiniteScroll() {
  if (!loadMoreSentinel.value)
    return

  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      const [entry] = entries

      if (!entry?.isIntersecting || trips.isLoadingHistory || !trips.historyHasMore)
        return

      loadMoreHistory().catch(() => {})
    },
    {
      root: scrollRoot.value,
      rootMargin: '240px 0px',
      threshold: 0.01,
    },
  )

  observer.observe(loadMoreSentinel.value)
}

onMounted(async () => {
  if (!trips.history.length)
    await refreshHistory().catch(() => {})

  await nextTick()
  setupInfiniteScroll()
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <main ref="scrollRoot" class="tg-safe-x tg-menu-inner-safe h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-xs text-main-300 font-900 uppercase">
            Пассажир
          </p>
          <h1 class="mt-1 text-3xl font-950">
            История поездок
          </h1>
          <p class="mt-1 text-sm text-slate-400 leading-5">
            Все ваши заказы и маршруты
          </p>
        </div>

        <button
          :disabled="trips.isLoadingHistory"
          aria-label="Обновить историю поездок"
          class="h-11 w-11 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-white transition active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
          title="Обновить"
          type="button"
          @click="refreshHistory"
        >
          <span
            class="text-5"
            :class="trips.isLoadingHistory ? 'i-mdi-loading animate-spin' : 'i-mdi-refresh'"
          />
        </button>
      </header>

      <div v-if="isInitialLoading" class="mt-8 space-y-3">
        <div
          v-for="item in 4"
          :key="item"
          class="h-32 animate-pulse rounded-3xl bg-white/6"
        />
      </div>

      <section
        v-else-if="isListEmpty"
        class="mt-10 rounded-3xl bg-white/5 px-5 py-8 text-center"
      >
        <div class="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-main-500/16 text-main-200">
          <span class="i-mdi-map-marker-path text-8" />
        </div>
        <h2 class="mt-4 text-xl font-950">
          Поездок пока нет
        </h2>
        <p class="mt-2 text-sm text-slate-400 leading-5">
          Когда вы закажете первую поездку, она появится здесь.
        </p>
        <RouterLink
          class="mt-5 h-12 inline-flex items-center justify-center rounded-2xl bg-main-500 px-5 text-sm text-white font-900 shadow-[0_12px_30px_rgba(230,173,46,0.28)]"
          to="/map"
        >
          Заказать такси
        </RouterLink>
      </section>

      <div v-else class="mt-6 space-y-3">
        <article
          v-for="trip in trips.history"
          :key="trip.id"
          class="rounded-3xl bg-white/5 p-4 shadow-black/10 shadow-lg"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-slate-500 font-800">
                {{ getTripDate(trip) }}
              </p>
              <h2 class="mt-1 truncate text-xl font-950">
                {{ getTripFare(trip) }}
              </h2>
              <p class="mt-1 text-xs text-slate-400 font-700">
                {{ getTripMeta(trip) }}
              </p>
            </div>

            <span
              class="shrink-0 rounded-full px-3 py-1.5 text-xs font-900"
              :class="statusMeta[trip.status].className"
            >
              {{ statusMeta[trip.status].label }}
            </span>
          </div>

          <div class="grid grid-cols-[20px_1fr] mt-4 gap-x-3">
            <div class="flex flex-col items-center pt-1">
              <span class="h-3 w-3 rounded-full bg-emerald-400" />
              <span class="my-1 h-8 w-px bg-white/15" />
              <span class="h-3 w-3 rounded-full bg-red-400" />
            </div>

            <div class="min-w-0 space-y-3">
              <p class="truncate text-sm font-800">
                {{ trip.pickup_address }}
              </p>
              <p class="truncate text-sm font-800">
                {{ trip.dropoff_address }}
              </p>
            </div>
          </div>

          <button
            v-if="trip.status === 'completed'"
            :disabled="trips.isRating"
            class="mt-4 h-11 w-full rounded-2xl bg-main-500/14 text-sm text-main-200 font-900 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="openRating(trip)"
          >
            Оценить поездку
          </button>

          <button
            :disabled="attachingTripId === trip.id"
            class="mt-2 h-11 w-full flex items-center justify-center gap-2 rounded-2xl bg-white/6 text-sm text-slate-200 font-900 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="contactSupport(trip)"
          >
            <span class="i-mdi-headset text-5" />
            {{ attachingTripId === trip.id ? 'Открываем...' : 'Поддержка по поездке' }}
          </button>
        </article>

        <div ref="loadMoreSentinel" class="h-1" />

        <div class="py-3 text-center">
          <p v-if="trips.isLoadingHistory" class="text-sm text-slate-400 font-800">
            Загружаем ещё...
          </p>

          <button
            v-else-if="trips.historyHasMore"
            class="h-11 rounded-2xl bg-white/8 px-5 text-sm text-slate-200 font-900 transition active:scale-[0.98]"
            type="button"
            @click="loadMoreHistory"
          >
            Загрузить ещё
          </button>

          <p v-else class="text-xs text-slate-500 font-800">
            Это вся история
          </p>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="ratingTrip"
          class="fixed inset-0 z-60 flex items-end bg-black/65 px-4 pb-[calc(var(--app-safe-area-bottom)+1rem)]"
          @click.self="closeRating"
        >
          <section class="mx-auto max-w-sm w-full rounded-3xl bg-secondary-900 p-5 text-white shadow-2xl shadow-black/30">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs text-main-300 font-900 uppercase">
                  Завершено
                </p>
                <h2 class="mt-1 text-2xl font-950">
                  Оцените поездку
                </h2>
              </div>
              <button aria-label="Закрыть оценку поездки" class="h-11 w-11 flex items-center justify-center rounded-full bg-white/8" type="button" @click="closeRating">
                <span class="i-mdi-close text-6" />
              </button>
            </div>

            <div class="mt-5 flex justify-center gap-1">
              <button
                v-for="score in 5"
                :key="score"
                :aria-label="`Поставить оценку ${score}`"
                class="h-11 w-11 flex items-center justify-center rounded-full transition active:scale-[0.94]"
                :class="score <= ratingScore ? 'text-main-300' : 'text-slate-600'"
                type="button"
                @click="ratingScore = score"
              >
                <span class="i-mdi-star text-8" />
              </button>
            </div>

            <textarea
              v-model="ratingComment"
              aria-label="Комментарий к оценке поездки"
              class="mt-5 min-h-24 w-full resize-none border border-white/10 rounded-2xl bg-white/6 p-4 text-sm outline-none focus:border-main-400"
              maxlength="500"
              name="rating_comment"
              placeholder="Комментарий, если хотите"
            />

            <button
              :disabled="trips.isRating"
              class="mt-4 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
              type="button"
              @click="submitRating"
            >
              {{ trips.isRating ? 'Отправляем...' : 'Отправить оценку' }}
            </button>
          </section>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>
