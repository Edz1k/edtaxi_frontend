<script setup lang="ts">
import type { StatBucket } from '~/utils/statsChart'
import StatBarChart from '~/components/charts/StatBarChart.vue'
import { formatWholeNumber } from '~/utils/statsChart'

// Карточка дашбордного чарта: заголовок, переключатель (период/метрика),
// readout выбранной корзины и сам барчарт. Данные и их агрегация — забота
// родителя, карточка только отображает готовые корзины.
const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  buckets: StatBucket[]
  loading?: boolean
  color?: 'cyan' | 'emerald' | 'gold'
  /** Кнопки-переключатели (период или метрика); выбор — через v-model:option. */
  options?: Array<{ value: string, label: string }>
  /** Readout выбранной корзины (крупное значение). По умолчанию — целое с разрядами. */
  formatValue?: (value: number) => string
  /** Подписи оси Y и значения над баром (компактные). */
  formatAxisValue?: (value: number) => string
  emptyText?: string
  footnote?: string
  valueHeader?: string
}>(), {
  color: 'cyan',
  emptyText: 'Пока нет данных за этот период.',
  formatValue: formatWholeNumber,
})

const option = defineModel<string>('option')

// Цвет readout повторяет цвет баров (классы фиксированными строками — UnoCSS).
const READOUT_COLORS: Record<NonNullable<typeof props.color>, string> = {
  cyan: 'text-cyan-100',
  emerald: 'text-emerald-100',
  gold: 'text-main-200',
}

const selectedIndex = ref(0)

// При смене данных/периода выбор возвращается на последнюю (текущую)
// корзину — то, что смотрят чаще всего.
watchImmediate(() => props.buckets, (buckets) => {
  selectedIndex.value = Math.max(0, buckets.length - 1)
})

const selectedBucket = computed(() => props.buckets[selectedIndex.value])
const hasData = computed(() => props.buckets.some(bucket => bucket.value > 0))
</script>

<template>
  <section class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-xs text-white/42 font-900 uppercase">
          {{ title }}
        </h3>
        <p v-if="subtitle" class="mt-0.5 text-xs text-white/38">
          {{ subtitle }}
        </p>
      </div>

      <div v-if="options?.length" aria-label="Режим диаграммы" class="flex shrink-0 rounded-xl bg-black/24 p-1" role="group">
        <button
          v-for="item in options"
          :key="item.value"
          :aria-pressed="option === item.value"
          class="rounded-lg px-2.5 py-1.5 text-xs font-900 transition-colors"
          :class="option === item.value ? 'bg-cyan-300 text-#06142f' : 'text-white/50 hover:text-white/80'"
          type="button"
          @click="option = item.value"
        >
          {{ item.label }}
        </button>
      </div>
    </header>

    <div v-if="loading" aria-busy="true" aria-label="Загружаем статистику" class="mt-4 h-56 animate-pulse rounded-2xl bg-white/6" />

    <div v-else-if="!hasData" class="mt-4 flex flex-col items-center gap-2 py-10 text-center" role="status">
      <span aria-hidden="true" class="i-mdi-chart-bar text-8 text-white/30" />
      <p class="text-sm text-white/50 font-700">
        {{ emptyText }}
      </p>
    </div>

    <template v-else>
      <!-- Readout выбранной корзины: значение — главное, период — подпись -->
      <div aria-live="polite" class="mt-4">
        <p class="text-2xl font-950" :class="READOUT_COLORS[color]">
          {{ formatValue(selectedBucket?.value ?? 0) }}
        </p>
        <p class="mt-0.5 text-xs text-white/45 font-700">
          {{ selectedBucket?.fullLabel }}<template v-if="selectedBucket?.hint">
            · {{ selectedBucket.hint }}
          </template>
        </p>
      </div>

      <StatBarChart
        v-model:selected-index="selectedIndex"
        :aria-label="`${title}. Выбирайте столбец стрелками влево и вправо`"
        :buckets="buckets"
        class="mt-3"
        :color="color"
        :format-axis-value="formatAxisValue"
        :table-caption="title"
        :value-header="valueHeader"
      />

      <p v-if="footnote" class="mt-2 text-xs text-white/38">
        {{ footnote }}
      </p>
    </template>
  </section>
</template>
