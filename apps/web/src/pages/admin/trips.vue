<script setup lang="ts">
import type { TripChatMessage } from '~/types/trip-chats'
import type { TripStatus } from '~/types/trips'
import { getAdminCities } from '~/api/admin'
import { mediaUrl } from '~/api/client'
import { getTripChatMessages } from '~/api/trip-chats'
import AppSelectDropdown from '~/components/app/AppSelectDropdown.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useListFilter } from '~/composables/useListFilter'
import { useAdminStore } from '~/stores/admin'
import { formatDate, formatFare } from '~/utils/format'

const admin = useAdminStore()
const { value: status, model: statusFilter } = useListFilter<TripStatus>()
const { value: city, model: cityFilter } = useListFilter<string>()

const searchInput = ref('')
const search = refDebounced(searchInput, 350)

const statuses: Array<{ label: string, value: TripStatus | '' }> = [
  { label: 'Все', value: '' },
  { label: 'Поиск', value: 'searching' },
  { label: 'Назначен', value: 'driver_assigned' },
  { label: 'Прибыл', value: 'driver_arriving' },
  { label: 'В пути', value: 'in_progress' },
  { label: 'Завершён', value: 'completed' },
  { label: 'Отменён', value: 'cancelled' },
]

// Города для фильтра — справочник с бэка (оффлайн-список крупных городов КЗ).
const cityOptions = ref<Array<{ label: string, value: string }>>([{ label: 'Все города', value: '' }])

const LIMIT = 20
const offset = ref(0)
const hasMore = computed(() => offset.value + LIMIT < admin.tripsTotal)

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    layout: 'admin',
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({
  title: 'Поездки | Админка',
})

onMounted(() => {
  load()
  getAdminCities()
    .then((response) => {
      cityOptions.value = [
        { label: 'Все города', value: '' },
        ...response.cities.map(name => ({ label: name, value: name })),
      ]
    })
    .catch(() => {})
})

watch([status, city, search], () => {
  offset.value = 0
  load()
})

function currentParams(nextOffset = offset.value) {
  return {
    status: status.value || undefined,
    city: city.value || undefined,
    search: search.value || undefined,
    limit: LIMIT,
    offset: nextOffset,
  }
}

function load() {
  admin.loadTrips(currentParams()).catch(() => {})
}

async function loadMore() {
  const nextOffset = offset.value + LIMIT
  const response = await admin.loadTrips(currentParams(nextOffset)).catch(() => null)
  if (response) {
    offset.value = nextOffset
  }
}

const STATUS_LABELS: Record<TripStatus, string> = {
  searching: 'Поиск',
  driver_assigned: 'Водитель назначен',
  driver_arriving: 'Водитель на месте',
  in_progress: 'В пути',
  completed: 'Завершена',
  cancelled: 'Отменена',
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  wallet: 'Кошелёк',
  kaspi: 'Kaspi',
}

const CATEGORY_LABELS: Record<string, string> = {
  economy: 'Эконом',
  comfort: 'Комфорт',
  business: 'Бизнес',
  minivan: 'Минивэн',
  moto: 'Мото',
}

function statusClass(s: TripStatus) {
  if (s === 'completed')
    return 'bg-emerald-500/12 text-emerald-300 md:bg-transparent'
  if (s === 'cancelled')
    return 'bg-red-500/12 text-red-300 md:bg-transparent'
  return 'bg-amber-500/12 text-amber-300 md:bg-transparent'
}

// --- Переписка поездки внутри детализации (read-only, контроль качества) ---
// Открытие поездки автоматически подтягивает её чат: staff-эндпоинт отдаёт
// переписку любой поездки, а не только активной, поэтому чат всегда доступен.
const chatMessages = ref<TripChatMessage[]>([])
const isLoadingChat = ref(false)
const chatError = ref(false)
const previewUrl = ref('')

const selectedTripId = computed(() => admin.selectedTrip?.id ?? '')
const passengerId = computed(() => admin.selectedTrip?.passenger_id ?? '')
const driverUserId = computed(() => admin.selectedTrip?.driver?.user_id ?? '')

watch(selectedTripId, async (id) => {
  chatMessages.value = []
  chatError.value = false
  previewUrl.value = ''
  if (!id)
    return

  isLoadingChat.value = true
  try {
    const response = await getTripChatMessages(id)
    chatMessages.value = response.messages
  }
  catch {
    chatError.value = true
  }
  finally {
    isLoadingChat.value = false
  }
})

function isPassengerMessage(senderId: string) {
  if (passengerId.value)
    return senderId === passengerId.value
  // Фолбэк, если у водителя не резолвился user_id: всё, что не водитель — пассажир.
  return driverUserId.value ? senderId !== driverUserId.value : true
}

function senderLabel(senderId: string) {
  return isPassengerMessage(senderId) ? 'Пассажир' : 'Водитель'
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function openPhoto(url?: null | string) {
  const resolved = url ? mediaUrl(url) : ''
  if (resolved)
    previewUrl.value = resolved
}

function closeTrip() {
  admin.selectedTrip = null
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape')
    return
  if (previewUrl.value)
    previewUrl.value = ''
  else if (admin.selectedTrip)
    closeTrip()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <WebPageShell
    embedded
    description="История заказов, статусы, стоимость, переписка поездки и быстрый просмотр деталей."
    title="Поездки"
  >
    <template #actions>
      <AppSelectDropdown v-model="cityFilter" label="Город" :options="cityOptions" />
      <AppSelectDropdown v-model="statusFilter" label="Статус" :options="statuses" />
    </template>

    <div class="relative mt-5">
      <span class="i-mdi-magnify absolute left-3.5 top-1/2 text-5 text-white/40 -translate-y-1/2" />
      <input
        v-model="searchInput"
        aria-label="Поиск по водителю, пассажиру или адресу"
        class="h-11 w-full border border-white/10 rounded-2xl bg-white/8 pl-11 pr-4 text-sm text-white outline-none transition focus:border-cyan-400/50"
        placeholder="Поиск по водителю, пассажиру, номеру телефона или адресу"
        type="search"
      >
    </div>

    <div class="mt-3 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
      <div class="grid-cols-[minmax(180px,1fr)_130px_120px_120px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
        <span>Маршрут</span>
        <span>Статус</span>
        <span>Цена</span>
        <span class="text-right">ID</span>
      </div>

      <div v-if="admin.isLoadingTrips && !admin.trips.length" class="px-4 py-6 text-sm text-white/50">
        Загружаем поездки...
      </div>

      <div v-else-if="!admin.trips.length" class="px-4 py-6 text-sm text-white/50">
        {{ search || city || status ? 'Ничего не найдено по фильтрам.' : 'Поездок нет.' }}
      </div>

      <button
        v-for="trip in admin.trips"
        v-else
        :key="trip.id"
        class="grid w-full gap-3 border-b border-white/6 px-4 py-4 text-left transition md:grid-cols-[minmax(180px,1fr)_130px_120px_120px] active:scale-[0.995] md:items-center last:border-b-0 hover:bg-white/4"
        type="button"
        @click="admin.loadTrip(trip.id)"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm font-900">{{ trip.pickup_address }}</span>
          <span class="mt-0.5 block truncate text-xs text-white/42">{{ trip.dropoff_address }}</span>
        </span>

        <span
          class="w-fit rounded-full px-2.5 py-1 text-xs font-900 md:w-auto md:rounded-none md:px-0 md:py-0 md:text-sm"
          :class="statusClass(trip.status)"
        >
          {{ STATUS_LABELS[trip.status] ?? trip.status }}
        </span>
        <span class="text-sm font-900">{{ formatFare(trip) }}</span>
        <span class="truncate text-left text-xs text-white/38 md:text-right">{{ trip.id.slice(0, 8) }}</span>
      </button>
    </div>

    <div class="mt-3 flex items-center justify-between">
      <p class="text-xs text-white/40">
        Показано {{ admin.trips.length }} из {{ admin.tripsTotal }}
      </p>
      <button
        v-if="hasMore"
        :disabled="admin.isLoadingTrips"
        class="h-9 border border-white/12 rounded-xl bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-50"
        type="button"
        @click="loadMore"
      >
        {{ admin.isLoadingTrips ? 'Загружаем...' : 'Загрузить ещё' }}
      </button>
    </div>

    <!-- Детали поездки: всплывающее окно поверх страницы -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
        <div
          v-if="admin.selectedTrip"
          class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          @click.self="closeTrip"
        >
          <section class="max-w-2xl w-full border border-white/10 rounded-3xl bg-#071a38 p-5 shadow-2xl">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="truncate text-xs text-white/42 font-900 uppercase">
                  Детали поездки · {{ admin.selectedTrip.id.slice(0, 8) }}
                </p>
                <h2 class="mt-1 text-xl font-950">
                  {{ formatFare(admin.selectedTrip) }}
                </h2>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="rounded-full px-3 py-2 text-xs font-900" :class="statusClass(admin.selectedTrip.status)">
                  {{ STATUS_LABELS[admin.selectedTrip.status] ?? admin.selectedTrip.status }}
                </span>
                <button
                  aria-label="Закрыть"
                  class="h-9 w-9 flex items-center justify-center rounded-full bg-white/8 text-white/60 transition hover:bg-white/14 hover:text-white"
                  type="button"
                  @click="closeTrip"
                >
                  <span class="i-mdi-close text-5" />
                </button>
              </div>
            </div>

            <!-- Маршрут -->
            <div class="grid mt-4 gap-3 sm:grid-cols-2">
              <p class="rounded-2xl bg-black/14 p-3 text-sm">
                <span class="block text-xs text-white/42 font-900 uppercase">Откуда</span>
                <span class="mt-1 block">{{ admin.selectedTrip.pickup_address }}</span>
              </p>
              <p class="rounded-2xl bg-black/14 p-3 text-sm">
                <span class="block text-xs text-white/42 font-900 uppercase">Куда</span>
                <span class="mt-1 block">{{ admin.selectedTrip.dropoff_address }}</span>
              </p>
            </div>

            <!-- Кто: пассажир и водитель -->
            <div class="grid mt-3 gap-3 sm:grid-cols-2">
              <div class="rounded-2xl bg-black/14 p-3 text-sm">
                <span class="block text-xs text-white/42 font-900 uppercase">Пассажир</span>
                <RouterLink
                  v-if="admin.selectedTrip.passenger_id"
                  :to="`/passengers/${admin.selectedTrip.passenger_id}`"
                  class="mt-1 flex items-center gap-1 text-cyan-200 font-800 hover:underline"
                >
                  {{ admin.selectedTrip.passenger_name || 'Кабинет пассажира' }}
                  <span class="i-mdi-open-in-new shrink-0 text-3.5 text-cyan-300/70" />
                </RouterLink>
                <span v-if="admin.selectedTrip.passenger_phone" class="mt-0.5 block text-xs text-white/45">
                  {{ admin.selectedTrip.passenger_phone }}
                </span>
              </div>

              <div class="rounded-2xl bg-black/14 p-3 text-sm">
                <span class="block text-xs text-white/42 font-900 uppercase">Водитель</span>
                <template v-if="admin.selectedTrip.driver">
                  <RouterLink
                    v-if="admin.selectedTrip.driver.user_id"
                    :to="`/drivers/${admin.selectedTrip.driver.user_id}`"
                    class="mt-1 flex items-center gap-1 text-cyan-200 font-800 hover:underline"
                  >
                    {{ admin.selectedTrip.driver.name || 'Кабинет водителя' }}
                    <span class="i-mdi-open-in-new shrink-0 text-3.5 text-cyan-300/70" />
                  </RouterLink>
                  <span v-else class="mt-1 block font-800">
                    {{ admin.selectedTrip.driver.name || 'Без имени' }}
                  </span>
                  <span class="mt-0.5 block text-xs text-white/45">
                    {{ admin.selectedTrip.driver.phone }}
                    <template v-if="admin.selectedTrip.driver.rating">
                      · ★ {{ admin.selectedTrip.driver.rating.toFixed(1) }}
                    </template>
                  </span>
                  <span v-if="admin.selectedTrip.driver.vehicle" class="mt-0.5 block text-xs text-white/45">
                    {{ admin.selectedTrip.driver.vehicle.make }} {{ admin.selectedTrip.driver.vehicle.model }} · {{ admin.selectedTrip.driver.vehicle.plate_number }}
                  </span>
                </template>
                <span v-else class="mt-1 block text-white/40">
                  Ещё не назначен
                </span>
              </div>
            </div>

            <!-- Сколько / параметры -->
            <div class="grid grid-cols-2 mt-3 gap-3 sm:grid-cols-4">
              <div class="rounded-2xl bg-black/14 p-3 text-sm">
                <span class="block text-xs text-white/42 font-900 uppercase">Тариф</span>
                <span class="mt-1 block font-800">{{ CATEGORY_LABELS[admin.selectedTrip.category] ?? admin.selectedTrip.category }}</span>
              </div>
              <div class="rounded-2xl bg-black/14 p-3 text-sm">
                <span class="block text-xs text-white/42 font-900 uppercase">Оплата</span>
                <span class="mt-1 block font-800">{{ PAYMENT_LABELS[admin.selectedTrip.payment_method ?? ''] ?? admin.selectedTrip.payment_method ?? '—' }}</span>
              </div>
              <div class="rounded-2xl bg-black/14 p-3 text-sm">
                <span class="block text-xs text-white/42 font-900 uppercase">Расстояние</span>
                <span class="mt-1 block font-800">{{ admin.selectedTrip.distance_km.toFixed(1) }} км</span>
              </div>
              <div class="rounded-2xl bg-black/14 p-3 text-sm">
                <span class="block text-xs text-white/42 font-900 uppercase">Время в пути</span>
                <span class="mt-1 block font-800">{{ Math.round(admin.selectedTrip.duration_min) }} мин</span>
              </div>
            </div>

            <!-- Когда: таймлайн -->
            <div class="mt-3 rounded-2xl bg-black/14 p-3 text-sm">
              <span class="block text-xs text-white/42 font-900 uppercase">Когда</span>
              <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-white/70">
                <span v-if="admin.selectedTrip.created_at">Создана: {{ formatDate(admin.selectedTrip.created_at) }}</span>
                <span v-if="admin.selectedTrip.driver_assigned_at">Назначен водитель: {{ formatDate(admin.selectedTrip.driver_assigned_at) }}</span>
                <span v-if="admin.selectedTrip.started_at">Начало поездки: {{ formatDate(admin.selectedTrip.started_at) }}</span>
                <span v-if="admin.selectedTrip.completed_at">Завершена: {{ formatDate(admin.selectedTrip.completed_at) }}</span>
                <span v-if="admin.selectedTrip.cancelled_at" class="text-red-300">
                  Отменена: {{ formatDate(admin.selectedTrip.cancelled_at) }}
                  <template v-if="admin.selectedTrip.cancelled_by">
                    ({{ admin.selectedTrip.cancelled_by }})
                  </template>
                </span>
              </div>
            </div>

            <!-- Переписка поездки: read-only контроль качества -->
            <div class="mt-3 rounded-2xl bg-black/14 p-3">
              <div class="flex items-center justify-between">
                <span class="text-xs text-white/42 font-900 uppercase">Переписка поездки</span>
                <span v-if="chatMessages.length" class="text-[11px] text-white/38 font-800">{{ chatMessages.length }} сообщ.</span>
              </div>

              <div v-if="isLoadingChat" class="mt-3 space-y-2">
                <div v-for="i in 3" :key="i" class="flex" :class="i % 2 === 0 ? 'justify-end' : 'justify-start'">
                  <div class="h-9 animate-pulse rounded-2xl bg-white/8" :class="i % 2 === 0 ? 'w-36' : 'w-48'" />
                </div>
              </div>

              <p v-else-if="chatError" class="mt-3 text-sm text-red-300/80">
                Не удалось загрузить переписку.
              </p>

              <p v-else-if="!chatMessages.length" class="mt-3 text-sm text-white/40">
                В этой поездке не переписывались.
              </p>

              <div v-else class="mt-3 max-h-72 overflow-y-auto pr-1 space-y-2">
                <div
                  v-for="msg in chatMessages"
                  :key="msg.id"
                  class="flex"
                  :class="isPassengerMessage(msg.sender_id) ? 'justify-start' : 'justify-end'"
                >
                  <article
                    class="max-w-[78%] rounded-2xl px-3 py-2"
                    :class="isPassengerMessage(msg.sender_id) ? 'rounded-bl-sm bg-white/10' : 'rounded-br-sm bg-cyan-300/14'"
                  >
                    <p class="text-[11px] font-900" :class="isPassengerMessage(msg.sender_id) ? 'text-white/45' : 'text-cyan-200/80'">
                      {{ senderLabel(msg.sender_id) }}
                    </p>
                    <button
                      v-if="msg.image_url"
                      class="mt-1 block w-full"
                      type="button"
                      @click="openPhoto(msg.image_url)"
                    >
                      <img
                        :src="mediaUrl(msg.image_url)"
                        alt="Вложение"
                        class="max-h-56 w-full rounded-xl object-cover transition hover:opacity-80"
                        loading="lazy"
                      >
                    </button>
                    <p v-if="msg.content" class="mt-1 text-sm text-white leading-[1.45]">
                      {{ msg.content }}
                    </p>
                    <p class="mt-1 text-[11px] text-white/40 font-700">
                      {{ formatTime(msg.sent_at) }}
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>

    <!-- Лайтбокс вложения чата -->
    <Teleport to="body">
      <div
        v-if="previewUrl"
        class="fixed inset-0 z-80 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        @click.self="previewUrl = ''"
      >
        <button
          aria-label="Закрыть"
          class="absolute right-4 top-4 h-11 w-11 flex items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          type="button"
          @click="previewUrl = ''"
        >
          <span class="i-mdi-close text-6" />
        </button>
        <img
          alt="Вложение"
          class="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl shadow-black/60"
          :src="previewUrl"
          @click.stop
        >
      </div>
    </Teleport>
  </WebPageShell>
</template>
