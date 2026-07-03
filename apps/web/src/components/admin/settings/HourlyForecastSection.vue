<script setup lang="ts">
import type { DemandForecastPoint, TariffCategory } from '~/types/admin'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '~/constants/admin'
import { useAdminStore } from '~/stores/admin'

const admin = useAdminStore()

// Данные прогноза приходят вместе с обзором спроса (admin.loadDemandOverview),
// который грузит соседняя секция «Текущий коэффициент спроса» на этой же странице.
const selectedForecastCategory = ref<TariffCategory>('economy')
const currentHour = new Date().getHours()

interface ForecastBar { hour: number, point: DemandForecastPoint | null }

const forecastBars = computed<ForecastBar[]>(() => {
  const points = (admin.demandOverview?.forecast ?? []).filter(p => p.category === selectedForecastCategory.value)
  const byHour = new Map(points.map(p => [p.hour, p]))
  return Array.from({ length: 24 }, (_, hour) => ({ hour, point: byHour.get(hour) ?? null }))
})

// Ось начинается от 0 (честная шкала для столбиков), верх — с запасом над
// максимумом истории, округлённый до 0.5, но не ниже 2.0x.
const forecastMax = computed(() => {
  const values = forecastBars.value.map(b => b.point?.avg_coefficient ?? 0)
  const max = Math.max(2.0, ...values)
  return Math.ceil((max + 0.2) * 2) / 2
})

function barHeightPct(bar: ForecastBar) {
  if (!bar.point)
    return 0
  return Math.max(4, (bar.point.avg_coefficient / forecastMax.value) * 100)
}

function barTooltip(bar: ForecastBar) {
  const hourLabel = `${String(bar.hour).padStart(2, '0')}:00`
  if (!bar.point)
    return `${hourLabel} — нет данных`
  return `${hourLabel} — ×${bar.point.avg_coefficient.toFixed(2)} (${bar.point.samples} поездок)`
}
</script>

<template>
  <section class="mt-8 border border-white/10 rounded-3xl bg-white/8 p-6 backdrop-blur">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-950">
          Прогноз по часам
        </h2>
        <p class="mt-1 max-w-xl text-sm text-white/55 leading-6">
          Средний коэффициент спроса по часам суток за последние 30 дней. Текущий час отмечен отдельно.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="category in CATEGORY_ORDER"
          :key="category"
          class="h-9 border rounded-full px-3.5 text-xs font-900 transition"
          :class="selectedForecastCategory === category
            ? 'border-cyan-300/50 bg-cyan-300/16 text-cyan-100'
            : 'border-white/10 bg-white/8 text-white/55 hover:bg-white/12'"
          type="button"
          @click="selectedForecastCategory = category"
        >
          {{ CATEGORY_LABELS[category] }}
        </button>
      </div>
    </div>

    <div class="mt-6">
      <div class="relative h-32 flex items-end gap-[2px] pt-4">
        <div v-for="bar in forecastBars" :key="bar.hour" class="group relative h-full flex flex-1 flex-col items-center justify-end">
          <span
            v-if="bar.hour === currentHour"
            class="absolute top-0 text-[9px] text-cyan-200 font-800 uppercase"
          >сейчас</span>
          <div
            class="w-full rounded-t-4px transition-colors"
            :class="bar.hour === currentHour ? 'bg-cyan-300' : (bar.point ? 'bg-cyan-300/35 group-hover:bg-cyan-300/60' : 'bg-white/10')"
            :style="{ height: `${barHeightPct(bar)}%` }"
            :title="barTooltip(bar)"
          />
        </div>
      </div>
      <div class="mt-1.5 flex gap-[2px]">
        <div v-for="bar in forecastBars" :key="bar.hour" class="flex-1 text-center text-[10px] text-white/35">
          {{ bar.hour % 4 === 0 ? bar.hour : '' }}
        </div>
      </div>
    </div>
  </section>
</template>
