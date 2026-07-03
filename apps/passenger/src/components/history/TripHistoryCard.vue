<script setup lang="ts">
import type { Trip, TripStatus } from '~/types/trips'
import { formatFare, TARIFF_META } from '~/constants/tariffs'
import { useTripsStore } from '~/stores/trips'

defineProps<{ trip: Trip, attaching?: boolean }>()
const emit = defineEmits<{ rate: [trip: Trip], complain: [trip: Trip], contactSupport: [trip: Trip] }>()

const trips = useTripsStore()

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

// Пожаловаться можно только на завершённую поездку с назначенным водителем —
// то же ограничение проверяет бэкенд.
function canComplain(trip: Trip) {
  return trip.status === 'completed' && Boolean(trip.driver || trip.driver_id)
}
</script>

<template>
  <article class="rounded-3xl bg-white/5 p-4 shadow-black/10 shadow-lg">
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
      @click="emit('rate', trip)"
    >
      Оценить поездку
    </button>

    <button
      :disabled="attaching"
      class="mt-2 h-11 w-full flex items-center justify-center gap-2 rounded-2xl bg-white/6 text-sm text-slate-200 font-900 transition active:scale-[0.98] disabled:opacity-60"
      type="button"
      @click="emit('contactSupport', trip)"
    >
      <span class="i-mdi-headset text-5" />
      {{ attaching ? 'Открываем...' : 'Поддержка по поездке' }}
    </button>

    <button
      v-if="canComplain(trip)"
      :disabled="trips.isFilingComplaint"
      class="mt-2 h-11 w-full flex items-center justify-center gap-2 rounded-2xl bg-red-500/10 text-sm text-red-300 font-900 transition active:scale-[0.98] disabled:opacity-60"
      type="button"
      @click="emit('complain', trip)"
    >
      <span class="i-mdi-alert-circle-outline text-5" />
      Пожаловаться на водителя
    </button>
  </article>
</template>
