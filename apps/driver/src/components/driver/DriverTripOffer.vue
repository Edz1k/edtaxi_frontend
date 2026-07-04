<script setup lang="ts">
import type { DriverTripOffer } from '~/types/websocket'
import { categoryLabel } from '~/utils/vehicleCategories'

defineProps<{
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
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-60 flex items-end bg-black/60 p-4 text-white backdrop-blur-sm">
      <section class="w-full rounded-3xl bg-secondary-900 p-5 shadow-2xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="flex items-center gap-2 text-xs text-main-300 font-900 uppercase">
              Новый заказ
              <span v-if="offer.category" class="rounded-full bg-main-500/18 px-2 py-0.5 text-[11px] text-main-200 normal-case">
                {{ categoryLabel(offer.category) }}
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
