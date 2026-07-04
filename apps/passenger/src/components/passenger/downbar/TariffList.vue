<script setup lang="ts">
import type { EstimateTripResponse, VehicleCategory } from '~/types/trips'
import { formatFare, TARIFF_META } from '~/constants/tariffs'

const props = defineProps<{
  destination: string
  estimates: EstimateTripResponse[]
  pickup: string
  selectedCategories: VehicleCategory[]
}>()

const emit = defineEmits<{
  editRoute: []
  toggleCategory: [category: VehicleCategory]
}>()

function isSelected(category: VehicleCategory) {
  return props.selectedCategories.includes(category)
}
</script>

<template>
  <div class="space-y-3">
    <div class="rounded-[1.65rem] bg-white/5 p-3">
      <div class="grid grid-cols-[18px_1fr_auto] items-center gap-3">
        <div class="flex flex-col items-center">
          <span class="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span class="my-1 h-6 w-px bg-white/15" />
          <span class="h-2.5 w-2.5 rounded-full bg-red-400" />
        </div>

        <div class="min-w-0 space-y-2">
          <p class="truncate text-sm text-white font-900">
            {{ pickup }}
          </p>
          <p class="truncate text-sm text-white font-900">
            {{ destination }}
          </p>
        </div>

        <button
          class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-white transition active:scale-95"
          type="button"
          @click="emit('editRoute')"
        >
          <span class="i-mdi-pencil text-5" />
        </button>
      </div>
    </div>

    <div>
      <p class="mb-2 px-1 text-[11px] text-main-300 font-900 uppercase">
        Тариф
      </p>

      <div class="space-y-2">
        <button
          v-for="tariff in estimates"
          :key="tariff.category"
          class="min-h-15 w-full flex items-center gap-3 border rounded-2xl px-3 py-2 text-left transition active:scale-[0.98]"
          :class="isSelected(tariff.category)
            ? 'border-main-400 bg-main-500/16 shadow-[0_14px_34px_rgba(230,173,46,0.18)]'
            : 'border-white/8 bg-white/5'"
          :aria-pressed="isSelected(tariff.category)"
          type="button"
          @click="emit('toggleCategory', tariff.category)"
        >
          <span class="h-11 w-11 flex shrink-0 items-center justify-center rounded-2xl bg-white/8">
            <span :class="TARIFF_META[tariff.category].icon" class="text-6" />
          </span>

          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm text-white font-900">
              {{ TARIFF_META[tariff.category].label }}
            </span>
            <span class="mt-0.5 block truncate text-[11px] text-slate-400 font-700">
              {{ TARIFF_META[tariff.category].caption }}
            </span>
          </span>

          <span class="shrink-0 text-right text-sm text-white font-950">
            {{ formatFare(tariff) }}
          </span>

          <span
            class="h-5 w-5 flex shrink-0 items-center justify-center rounded-full"
            :class="isSelected(tariff.category) ? 'bg-main-500 text-white' : 'bg-white/8 text-transparent'"
          >
            <span class="i-mdi-check text-3.5" />
          </span>
        </button>
      </div>

      <p v-if="selectedCategories.length > 1" class="mt-2 px-1 text-[11px] text-slate-400 font-700 leading-4">
        Можно выбрать несколько тарифов — приедет тот, кто примет заказ первым
      </p>
    </div>
  </div>
</template>
