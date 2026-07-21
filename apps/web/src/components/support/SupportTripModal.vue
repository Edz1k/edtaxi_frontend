<script setup lang="ts">
import type { Trip } from '~/types/trips'
import { mediaUrl } from '~/api/client'
import { getTechSupportTrip } from '~/api/support'
import { formatFare } from '~/utils/format'
import { paymentLabel, tripStatusLabel } from '~/utils/support'

// Деталь поездки для агента поддержки: тот же эндпоинт-двойник админского
// GET /admin/trips/:id (пассажир и водитель с контактами). Своя лёгкая
// модалка, а не реюз admin/trips.vue: та вросла в стор админки и стягивает
// чат поездки — поддержке из тикета нужны сама поездка, участники и ссылки
// в кабинеты (чаты поездок у неё на отдельной странице /support/trip-chats).
const props = defineProps<{ tripId: string }>()
const emit = defineEmits<{ close: [] }>()

const trip = ref<null | Trip>(null)
const isLoading = ref(true)
const loadFailed = ref(false)

onMounted(async () => {
  try {
    trip.value = await getTechSupportTrip(props.tripId)
  }
  catch {
    loadFailed.value = true
  }
  finally {
    isLoading.value = false
  }
})

function formatTime(value?: null | string) {
  if (!value)
    return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

const timeline = computed(() => {
  const t = trip.value
  if (!t)
    return []
  return [
    { label: 'Создана', value: t.created_at },
    { label: 'Водитель назначен', value: t.driver_assigned_at },
    { label: 'Началась', value: t.started_at },
    { label: 'Завершена', value: t.completed_at },
    { label: 'Отменена', value: t.cancelled_at },
  ].filter(item => item.value)
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape')
    emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="emit('close')">
    <div class="max-h-[85vh] max-w-lg w-full overflow-y-auto border border-white/10 rounded-2xl bg-secondary-950 p-5 shadow-2xl">
      <div class="flex items-start justify-between gap-3">
        <h2 class="text-lg text-white font-950">
          Поездка
        </h2>
        <button aria-label="Закрыть" class="p-1 text-white/50 transition hover:text-white" type="button" @click="emit('close')">
          <span class="i-mdi-close text-5" aria-hidden="true" />
        </button>
      </div>

      <p v-if="isLoading" class="py-8 text-center text-sm text-white/55 font-800">
        Загружаем поездку...
      </p>
      <p v-else-if="loadFailed || !trip" class="py-8 text-center text-sm text-red-300 font-800">
        Не удалось загрузить поездку.
      </p>

      <template v-else>
        <p class="mt-2 inline-block rounded-lg bg-white/6 px-2 py-1 text-xs text-white/70 font-900">
          {{ tripStatusLabel(trip.status) }}
        </p>

        <div class="mt-3 border border-white/8 rounded-xl bg-white/4 p-3 text-sm text-white/80 font-800 space-y-1.5">
          <p><span class="text-white/40">Откуда:</span> {{ trip.pickup_address }}</p>
          <p><span class="text-white/40">Куда:</span> {{ trip.dropoff_address }}</p>
        </div>

        <div class="grid grid-cols-2 mt-3 gap-2 text-xs text-white/60 font-800">
          <span>{{ formatFare(trip) }}</span>
          <span>{{ paymentLabel(trip.payment_method) }}</span>
          <span v-for="item in timeline" :key="item.label">{{ item.label }}: {{ formatTime(item.value) }}</span>
        </div>

        <!-- Пассажир: имя и телефон из детали, ссылка в кабинет -->
        <RouterLink
          v-if="trip.passenger_id"
          class="mt-3 flex items-center justify-between gap-3 border border-white/8 rounded-xl bg-white/4 p-3 transition hover:bg-white/8"
          :to="`/passengers/${trip.passenger_id}`"
        >
          <div class="min-w-0">
            <p class="text-[11px] text-white/40 font-900 uppercase">
              Пассажир
            </p>
            <p class="mt-1 truncate text-sm text-white/85 font-900">
              {{ trip.passenger_name || 'Без имени' }}
            </p>
            <p v-if="trip.passenger_phone" class="mt-0.5 text-xs text-white/55 font-800">
              {{ trip.passenger_phone }}
            </p>
          </div>
          <span class="i-mdi-chevron-right shrink-0 text-5 text-white/35" aria-hidden="true" />
        </RouterLink>

        <!-- Водитель: контакты и машина — то, ради чего поддержка открывает
             поездку по «забыл вещь». user_id — ключ кабинета /drivers/:id. -->
        <RouterLink
          v-if="trip.driver"
          class="mt-2 flex items-center justify-between gap-3 border border-white/8 rounded-xl bg-white/4 p-3 transition hover:bg-white/8"
          :to="trip.driver.user_id ? `/drivers/${trip.driver.user_id}` : ''"
        >
          <div class="min-w-0 flex items-center gap-3">
            <div class="h-11 w-11 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
              <img v-if="trip.driver.avatar_url" alt="" class="h-full w-full object-cover" :src="mediaUrl(trip.driver.avatar_url)">
              <span v-else class="i-mdi-account text-6 text-white/40" aria-hidden="true" />
            </div>
            <div class="min-w-0">
              <p class="text-[11px] text-white/40 font-900 uppercase">
                Водитель
              </p>
              <p class="mt-1 truncate text-sm text-white/85 font-900">
                {{ trip.driver.name || 'Без имени' }}
                <span class="text-xs text-amber-300 font-800">★ {{ trip.driver.rating.toFixed(1) }}</span>
              </p>
              <p v-if="trip.driver.phone" class="mt-0.5 text-xs text-white/55 font-800">
                {{ trip.driver.phone }}
              </p>
              <p v-if="trip.driver.vehicle" class="mt-0.5 truncate text-xs text-white/55 font-800">
                {{ trip.driver.vehicle.make }} {{ trip.driver.vehicle.model }} · {{ trip.driver.vehicle.plate_number }}
              </p>
            </div>
          </div>
          <span class="i-mdi-chevron-right shrink-0 text-5 text-white/35" aria-hidden="true" />
        </RouterLink>
        <p v-else class="mt-2 text-xs text-white/45 font-800">
          Водитель ещё не назначен.
        </p>
      </template>
    </div>
  </div>
</template>
