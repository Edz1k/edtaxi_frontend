<script setup lang="ts">
import type { PassengerOverview, PassengerTrip } from '~/types/passenger-overview'
import { useRoute as useVueRoute } from 'vue-router'
import { mediaUrl } from '~/api/client'
import { adminSetPassengerRating } from '~/api/driver'
import { showErrorToast } from '~/api/errors'
import { getPassengerOverview } from '~/api/passenger'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useToast } from '~/composables/useToast'
import { useAuthStore } from '~/stores/auth'
import { formatDate } from '~/utils/format'

const route = useVueRoute()
const userId = computed(() => (route.params as Record<string, string>).id)

const auth = useAuthStore()
const toast = useToast()
// Ручная правка рейтинга пассажира — только админам (не техподдержке).
const isAdmin = computed(() => auth.hasAnyRole(['admin', 'superadmin']))

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

// --- Изменение рейтинга пассажира (только админ) ---

const isRatingOpen = ref(false)
const ratingForm = reactive({ rating: 5 })
const isSavingRating = ref(false)

function openRating() {
  ratingForm.rating = data.value?.user.passenger_rating ?? 5
  isRatingOpen.value = true
}

async function saveRating() {
  if (isSavingRating.value)
    return
  isSavingRating.value = true
  try {
    await adminSetPassengerRating(userId.value, Number(ratingForm.rating))
    toast.success('Рейтинг обновлён', `Новый рейтинг пассажира: ${Number(ratingForm.rating).toFixed(2)}`)
    isRatingOpen.value = false
    await load()
  }
  catch (error) {
    showErrorToast(error, 'Не удалось изменить рейтинг.')
  }
  finally {
    isSavingRating.value = false
  }
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
              <img v-if="data.user.avatar_url" :src="mediaUrl(data.user.avatar_url)" alt="" class="h-full w-full object-cover">
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
            <!-- Ручная правка — только админ -->
            <button
              v-if="isAdmin"
              class="mt-1 inline-flex items-center gap-1 text-xs text-cyan-200 font-800 hover:underline"
              type="button"
              @click="openRating"
            >
              <span class="i-mdi-pencil-outline text-3.5" />
              Изменить
            </button>
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

    <!-- Модалка правки рейтинга пассажира (только админ) -->
    <Teleport to="body">
      <div
        v-if="isRatingOpen"
        class="fixed inset-0 z-70 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
        @click.self="isRatingOpen = false"
      >
        <form
          class="max-w-sm w-full border border-white/10 rounded-3xl bg-#071a38 p-5 shadow-2xl"
          @submit.prevent="saveRating"
        >
          <h3 class="text-lg font-950">
            Изменить рейтинг пассажира
          </h3>
          <label class="grid mt-4 gap-1.5">
            <span class="text-xs text-white/42 font-900 uppercase">Новый рейтинг (1–5)</span>
            <input
              v-model.number="ratingForm.rating"
              class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
              max="5"
              min="1"
              step="0.01"
              type="number"
            >
          </label>
          <div class="mt-4 flex gap-2">
            <button
              :disabled="isSavingRating || ratingForm.rating < 1 || ratingForm.rating > 5"
              class="h-11 flex-1 rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
              type="submit"
            >
              {{ isSavingRating ? 'Сохраняем...' : 'Сохранить' }}
            </button>
            <button
              class="h-11 border border-white/12 rounded-2xl bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12"
              type="button"
              @click="isRatingOpen = false"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </WebPageShell>
</template>
