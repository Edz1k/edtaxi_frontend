<script setup lang="ts">
import type { Trip } from '~/types/trips'
import { getDriverTripHistory } from '~/api/driver'
import { showErrorToast } from '~/api/errors'
import { useToast } from '~/composables/useToast'
import { useSupportStore } from '~/stores/support'

const support = useSupportStore()
const router = useRouter()
const toast = useToast()

const trips = ref<Trip[]>([])
const isLoading = ref(false)
const hasMore = ref(true)
const attachingTripId = ref<string | null>(null)
const PAGE = 20

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'История поездок',
  },
})

useHead({
  title: 'История поездок | EdTaxi Driver',
})

onMounted(() => {
  if (!trips.value.length)
    load()
})

async function load() {
  if (isLoading.value)
    return
  isLoading.value = true
  try {
    const res = await getDriverTripHistory({ limit: PAGE, offset: trips.value.length })
    const batch = res.trips ?? []
    trips.value = [...trips.value, ...batch]
    hasMore.value = batch.length === PAGE
  }
  catch (error) {
    showErrorToast(error, 'Не удалось загрузить историю поездок.')
  }
  finally {
    isLoading.value = false
  }
}

async function contactSupport(trip: Trip) {
  if (attachingTripId.value)
    return
  attachingTripId.value = trip.id
  try {
    await support.attachTrip(trip.id, 'driver')
    await router.push('/menu/support')
  }
  catch {
    toast.error('Ошибка', 'Не удалось открыть поддержку по поездке.')
  }
  finally {
    attachingTripId.value = null
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  economy: 'Эконом',
  comfort: 'Комфорт',
  business: 'Бизнес',
  minivan: 'Минивэн',
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Завершена',
  cancelled: 'Отменена',
  in_progress: 'В пути',
  driver_assigned: 'Назначена',
  driver_arriving: 'Подача',
  searching: 'Поиск',
}

function statusClass(status: string) {
  if (status === 'completed')
    return 'bg-emerald-500/12 text-emerald-300'
  if (status === 'cancelled')
    return 'bg-red-500/12 text-red-300'
  return 'bg-amber-500/12 text-amber-300'
}

function fare(trip: Trip) {
  const amount = trip.final_fare ?? trip.estimated_fare
  return `${Math.round(amount).toLocaleString('ru-RU')} ₸`
}

function tripDate(trip: Trip) {
  if (!trip.created_at)
    return ''
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'long' }).format(new Date(trip.created_at))
}
</script>

<template>
  <main class="p h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+2rem)] text-white">
    <section class="mx-auto max-w-sm">
      <div v-if="isLoading && !trips.length" class="mt-10 space-y-3">
        <div v-for="i in 4" :key="i" class="h-28 animate-pulse rounded-3xl bg-white/6" />
      </div>

      <div v-else-if="!trips.length" class="mt-16 rounded-3xl bg-white/5 px-5 py-8 text-center">
        <div class="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-main-500/16 text-main-200">
          <span class="i-mdi-map-marker-path text-8" />
        </div>
        <h2 class="mt-4 text-xl font-950">
          Поездок пока нет
        </h2>
        <p class="mt-2 text-sm text-slate-400 leading-5">
          Завершённые заказы появятся здесь.
        </p>
      </div>

      <div v-else class="mt-4 space-y-3">
        <article v-for="trip in trips" :key="trip.id" class="rounded-3xl bg-white/5 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-slate-500 font-800">
                {{ tripDate(trip) }}
              </p>
              <h2 class="mt-1 truncate text-xl font-950">
                {{ fare(trip) }}
              </h2>
              <p class="mt-1 text-xs text-slate-400 font-700">
                {{ CATEGORY_LABELS[trip.category] ?? trip.category }} · {{ trip.distance_km.toFixed(1) }} км
              </p>
            </div>
            <span class="shrink-0 rounded-full px-3 py-1.5 text-xs font-900" :class="statusClass(trip.status)">
              {{ STATUS_LABELS[trip.status] ?? trip.status }}
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
            :disabled="attachingTripId === trip.id"
            class="mt-4 h-11 w-full flex items-center justify-center gap-2 rounded-2xl bg-white/6 text-sm text-slate-200 font-900 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="contactSupport(trip)"
          >
            <span class="i-mdi-headset text-5" />
            {{ attachingTripId === trip.id ? 'Открываем...' : 'Поддержка по поездке' }}
          </button>
        </article>

        <div class="py-2 text-center">
          <button
            v-if="hasMore"
            :disabled="isLoading"
            class="h-11 rounded-2xl bg-white/8 px-5 text-sm text-slate-200 font-900 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="load"
          >
            {{ isLoading ? 'Загружаем...' : 'Загрузить ещё' }}
          </button>
          <p v-else class="text-xs text-slate-500 font-800">
            Это вся история
          </p>
        </div>
      </div>
    </section>
  </main>
</template>
