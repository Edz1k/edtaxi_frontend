<script setup lang="ts">
import type { DriverTripOffer } from '~/types/websocket'
import { tripOptionBadges } from '~/utils/tripOptions'
import { categoryLabel } from '~/utils/vehicleCategories'

const props = defineProps<{
  isBusy: boolean
  offer: DriverTripOffer
}>()

const emit = defineEmits<{
  accept: []
  reject: []
}>()

function formatFare(value: number) {
  return `${Math.round(value).toLocaleString('ru-RU')} ₸`
}

const stops = computed(() => props.offer.stops ?? [])
const optionBadges = computed(() => tripOptionBadges(props.offer.options))
// Ставка ₸/км (с сюрджем, п.40). 0/отсутствует у легаси-поездок — бейдж прячем.
const perKmLabel = computed(() => {
  const rate = props.offer.per_km ?? 0
  return rate > 0 ? `${Math.round(rate).toLocaleString('ru-RU')} ₸/км` : ''
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-60 flex items-end bg-black/60 p-4 text-white backdrop-blur-sm">
      <section class="w-full rounded-3xl bg-secondary-900 p-5 shadow-2xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="flex flex-wrap items-center gap-2 text-xs text-main-300 font-900 uppercase">
              Новый заказ
              <span v-if="offer.category" class="rounded-full bg-main-500/18 px-2 py-0.5 text-[11px] text-main-200 normal-case">
                {{ categoryLabel(offer.category) }}
              </span>
              <span v-if="perKmLabel" class="rounded-full bg-emerald-500/18 px-2 py-0.5 text-[11px] text-emerald-200 normal-case">
                {{ perKmLabel }}
              </span>
            </p>
            <h2 class="mt-2 text-3xl font-950">
              {{ formatFare(offer.estimated_fare) }}
            </h2>
          </div>

          <div class="h-12 w-12 flex items-center justify-center rounded-2xl bg-main-500/18 text-main-200">
            <span class="i-mdi-timer-sand text-7" />
          </div>
        </div>

        <div class="grid grid-cols-[20px_1fr] mt-5 gap-x-3">
          <div class="flex flex-col items-center pt-1">
            <span class="h-3 w-3 rounded-full bg-emerald-400" />
            <template v-for="index in stops.length" :key="`dot-${index}`">
              <span class="my-1 h-5 w-px bg-white/15" />
              <span class="h-2.5 w-2.5 rounded-full bg-amber-400" />
            </template>
            <span class="my-1 h-10 w-px bg-white/15" />
            <span class="h-3 w-3 rounded-full bg-red-400" />
          </div>

          <div class="min-w-0 space-y-4">
            <div>
              <p class="text-[11px] text-slate-500 font-800 uppercase">
                Посадка
              </p>
              <p class="mt-1 text-sm font-900">
                {{ offer.pickup_address }}
              </p>
            </div>

            <!-- Промежуточные остановки: водитель видит их ДО принятия -->
            <div v-for="(stop, index) in stops" :key="`stop-${index}`">
              <p class="text-[11px] text-amber-300/80 font-800 uppercase">
                Остановка {{ index + 1 }}
              </p>
              <p class="mt-1 text-sm font-800">
                {{ stop.address }}
              </p>
            </div>

            <div>
              <p class="text-[11px] text-slate-500 font-800 uppercase">
                Куда
              </p>
              <p class="mt-1 text-sm font-900">
                {{ offer.dropoff_address }}
              </p>
            </div>
          </div>
        </div>

        <!-- Опции заказа (доплата уже в цене выше) -->
        <div v-if="optionBadges.length" class="mt-4 flex flex-wrap gap-1.5">
          <span
            v-for="badge in optionBadges"
            :key="badge.label"
            class="inline-flex items-center gap-1.5 rounded-full bg-main-500/14 px-2.5 py-1 text-[12px] text-main-200 font-800"
          >
            <span :class="badge.icon" class="text-4" aria-hidden="true" />
            {{ badge.label }}
          </span>
        </div>

        <!-- Комментарий пассажира -->
        <p
          v-if="offer.comment"
          class="mt-3 flex items-start gap-2 rounded-2xl bg-white/6 px-3 py-2.5 text-[13px] text-slate-200 leading-4.5"
        >
          <span class="i-mdi-message-text-outline mt-0.5 shrink-0 text-4.5 text-main-300" aria-hidden="true" />
          {{ offer.comment }}
        </p>

        <div class="grid grid-cols-2 mt-6 gap-3">
          <button
            :disabled="isBusy"
            class="h-14 rounded-2xl bg-red-500/12 text-red-300 font-900 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="emit('reject')"
          >
            Отклонить
          </button>

          <button
            :disabled="isBusy"
            class="h-14 rounded-2xl bg-main-500 text-white font-900 shadow-lg shadow-main-500/20 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="emit('accept')"
          >
            Принять
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
