<script setup lang="ts">
import type { Trip } from '~/types/trips'
import TripComplaintModal from '~/components/history/TripComplaintModal.vue'
import TripHistoryCard from '~/components/history/TripHistoryCard.vue'
import TripRatingModal from '~/components/history/TripRatingModal.vue'
import { useToast } from '~/composables/useToast'
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
const complaintTrip = ref<Trip | null>(null)
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

const isInitialLoading = computed(() => trips.isLoadingHistory && !trips.history.length)
const isListEmpty = computed(() => !trips.isLoadingHistory && !trips.history.length)

async function refreshHistory() {
  trips.resetHistory()
  await trips.loadHistory(20, 0)
}

async function loadMoreHistory() {
  await trips.loadMoreHistory(20)
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
        <TripHistoryCard
          v-for="trip in trips.history"
          :key="trip.id"
          :attaching="attachingTripId === trip.id"
          :trip="trip"
          @rate="ratingTrip = $event"
          @complain="complaintTrip = $event"
          @contact-support="contactSupport"
        />

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

    <TripRatingModal :trip="ratingTrip" @close="ratingTrip = null" />
    <TripComplaintModal :trip="complaintTrip" @close="complaintTrip = null" />
  </main>
</template>
