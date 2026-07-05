<script setup lang="ts">
import type { VehicleCategory } from '~/types/trips'
import { formatFare, PAYMENT_META, PAYMENT_ORDER, TARIFF_META, TARIFF_ORDER } from '~/constants/tariffs'
import { useTripsStore } from '~/stores/trips'

defineProps<{
  primaryText: string
  isOrdering: boolean
}>()

const emit = defineEmits<{
  editRoute: []
  order: []
}>()

const trips = useTripsStore()

// Тарифы в каноничном порядке (стор наполняет по мере оценки).
const tariffs = computed(() =>
  TARIFF_ORDER
    .map(category => trips.tariffEstimates.find(estimate => estimate.category === category))
    .filter(estimate => estimate !== undefined),
)

function isSelected(category: VehicleCategory) {
  return trips.selectedCategory === category
}
</script>

<template>
  <div class="space-y-3">
    <!-- Маршрут -->
    <div class="flex items-center gap-3 rounded-[1.65rem] bg-white/5 p-3">
      <div class="flex flex-col items-center">
        <span class="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
        <span class="my-1 h-5 w-px bg-white/15" aria-hidden="true" />
        <span class="h-2.5 w-2.5 rounded-full bg-red-400" aria-hidden="true" />
      </div>

      <div class="min-w-0 flex-1 space-y-2">
        <p class="truncate text-sm text-white font-900">
          {{ trips.pickup }}
        </p>
        <p class="truncate text-sm text-white font-900">
          {{ trips.destination }}
        </p>
      </div>

      <button
        aria-label="Изменить маршрут"
        class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-white transition active:scale-95 hover:bg-white/12"
        type="button"
        @click="emit('editRoute')"
      >
        <span class="i-mdi-pencil text-5" aria-hidden="true" />
      </button>
    </div>

    <!-- Тарифы: боковая scroll-snap карусель, одиночный выбор -->
    <div>
      <p class="mb-2 px-1 text-[11px] text-main-300 font-900 uppercase">
        Тариф
      </p>

      <div
        class="[scrollbar-width:none] flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-1 -mx-3 [&::-webkit-scrollbar]:hidden"
        role="radiogroup"
        aria-label="Выбор тарифа"
      >
        <button
          v-for="tariff in tariffs"
          :key="tariff.category"
          class="w-27 flex shrink-0 flex-col snap-center items-center gap-1.5 border rounded-2xl px-3 py-3 transition active:scale-[0.97]"
          :class="isSelected(tariff.category)
            ? 'border-main-400 bg-main-500/16 shadow-[0_14px_34px_rgba(230,173,46,0.18)]'
            : 'border-white/8 bg-white/5'"
          role="radio"
          :aria-checked="isSelected(tariff.category)"
          type="button"
          @click="trips.selectCategory(tariff.category)"
        >
          <span
            class="h-12 w-12 flex items-center justify-center rounded-2xl transition"
            :class="isSelected(tariff.category) ? 'bg-main-500/22 text-main-200' : 'bg-white/8 text-white'"
          >
            <span :class="TARIFF_META[tariff.category].icon" class="text-6.5" aria-hidden="true" />
          </span>
          <span class="text-sm text-white font-900">
            {{ TARIFF_META[tariff.category].label }}
          </span>
          <span class="text-sm text-white font-950">
            {{ formatFare(tariff) }}
          </span>
        </button>
      </div>

      <p class="mt-1.5 truncate px-1 text-[11px] text-slate-400 font-700">
        {{ TARIFF_META[trips.selectedCategory].caption }}
      </p>
    </div>

    <!-- Способ оплаты (пока UI-only) -->
    <div class="flex items-center gap-1 rounded-[1.65rem] bg-white/5 p-1.5">
      <span class="shrink-0 pl-2 pr-1 text-[11px] text-slate-400 font-800 uppercase">
        Оплата
      </span>
      <button
        v-for="method in PAYMENT_ORDER"
        :key="method"
        class="h-10 flex flex-1 items-center justify-center gap-1.5 rounded-[1.3rem] text-sm font-900 transition active:scale-[0.98]"
        :class="trips.paymentMethod === method ? 'bg-white/12 text-white' : 'text-slate-400 hover:text-white'"
        :aria-pressed="trips.paymentMethod === method"
        type="button"
        @click="trips.setPaymentMethod(method)"
      >
        <span :class="PAYMENT_META[method].icon" class="text-4.5" aria-hidden="true" />
        {{ PAYMENT_META[method].label }}
      </button>
    </div>

    <!-- Заказать -->
    <button
      :disabled="isOrdering"
      class="h-13 w-full rounded-[1.35rem] bg-main-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.26)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
      type="button"
      @click="emit('order')"
    >
      {{ primaryText }}
    </button>
  </div>
</template>
