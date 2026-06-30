<script setup lang="ts">
import type { PassengerOverview, PassengerTrip } from '~/types/passenger-overview'
import { useRoute as useVueRoute } from 'vue-router'
import { getPassengerOverview } from '~/api/passenger'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { formatDate } from '~/utils/format'

const route = useVueRoute()
const userId = computed(() => (route.params as Record<string, string>).id)

const data = ref<PassengerOverview | null>(null)
const isLoading = ref(true)
const errorMessage = ref('')

definePage({
  meta: {
    authRedirect: '/support/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin', 'tech_support'],
  },
})

useHead({
  title: 'Кабинет пассажира | EdTaxi',
})

onMounted(load)

async function load() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    data.value = await getPassengerOverview(userId.value)
  }
  catch {
    errorMessage.value = 'Не удалось загрузить данные пассажира.'
  }
  finally {
    isLoading.value = false
  }
}

const fullName = computed(() => {
  const u = data.value?.user
  if (!u)
    return ''
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  if (name)
    return name
  if (u.telegram_username)
    return `@${u.telegram_username}`
  return u.phone
})

const TRIP_STATUS_LABELS: Record<string, string> = {
  searching: 'Поиск',
  driver_assigned: 'Водитель назначен',
  driver_arriving: 'Водитель в пути',
  driver_arrived: 'Водитель на месте',
  in_progress: 'В пути',
  completed: 'Завершена',
  cancelled: 'Отменена',
}

function tripStatusClass(status: string) {
  if (status === 'completed')
    return 'bg-emerald-500/12 text-emerald-300'
  if (status === 'cancelled')
    return 'bg-red-500/12 text-red-300'
  return 'bg-amber-500/12 text-amber-300'
}

function tripFare(t: PassengerTrip) {
  const amount = t.final_fare ?? t.estimated_fare
  return `${Math.round(amount).toLocaleString('ru-RU')} ₸`
}
</script>

<template>
  <WebPageShell
    back-label="Поддержка"
    back-to="/support"
    eyebrow="Пассажир"
    :title="fullName || 'Кабинет пассажира'"
  >
    <div v-if="isLoading" class="mt-6 text-sm text-white/55">
      Загружаем данные пассажира...
    </div>

    <div v-else-if="errorMessage" class="mt-6 rounded-2xl bg-red-500/10 px-4 py-4 text-sm text-red-300">
      {{ errorMessage }}
    </div>

    <div v-else-if="data" class="mt-5 space-y-5">
      <!-- Профиль -->
      <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
          <div class="flex items-center gap-4">
            <div class="h-16 w-16 flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-cyan-500/15">
              <img v-if="data.user.avatar_url" :src="data.user.avatar_url" alt="" class="h-full w-full object-cover">
              <span v-else class="i-mdi-account text-8 text-cyan-300" />
            </div>
            <div class="min-w-0">
              <p class="truncate text-lg font-950">
                {{ fullName }}
              </p>
              <p class="truncate text-sm text-white/55">
                {{ data.user.phone }}
              </p>
              <p v-if="data.user.telegram_username" class="truncate text-xs text-cyan-200/70">
                @{{ data.user.telegram_username }}
              </p>
            </div>
          </div>

          <div v-if="data.user.is_blocked" class="mt-4">
            <span class="rounded-full bg-red-500/12 px-3 py-1 text-xs text-red-300 font-900">
              Аккаунт заблокирован
            </span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur">
            <p class="text-xs text-white/45 font-800 uppercase">
              Рейтинг пассажира
            </p>
            <p class="mt-1 text-2xl font-950" :class="data.user.passenger_rating < 4.5 ? 'text-amber-300' : 'text-emerald-300'">
              {{ data.user.passenger_rating.toFixed(2) }}
            </p>
          </div>
          <div class="border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur">
            <p class="text-xs text-white/45 font-800 uppercase">
              В сервисе с
            </p>
            <p class="mt-1 text-lg font-950">
              {{ formatDate(data.user.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Поездки -->
      <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <h2 class="text-lg font-950">
          Последние поездки
        </h2>
        <p v-if="!data.recent_trips.length" class="mt-3 text-sm text-white/50">
          Поездок пока нет.
        </p>
        <div v-else class="mt-4 space-y-2">
          <div v-for="t in data.recent_trips" :key="t.id" class="border border-white/8 rounded-2xl bg-white/5 px-4 py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm text-white/75">
                  {{ t.pickup_address || '—' }} → {{ t.dropoff_address || '—' }}
                </p>
                <p class="mt-0.5 text-xs text-white/45">
                  {{ formatDate(t.created_at) }} · {{ tripFare(t) }}
                </p>
              </div>
              <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-900" :class="tripStatusClass(t.status)">
                {{ TRIP_STATUS_LABELS[t.status] ?? t.status }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </WebPageShell>
</template>
