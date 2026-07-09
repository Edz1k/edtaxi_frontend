<script setup lang="ts">
import type { StatBucket } from '~/utils/statsChart'
import { formatCompactNumber, niceCeil } from '~/utils/statsChart'

// Обобщённый SVG-барчарт дашбордов (дизайн — водительский EarningsBarChart):
// скруглённые вершины, прореживание оси X, подпись значения над выбранным
// баром, выбор клавиатурой и кликом по всей полосе корзины.
const props = withDefaults(defineProps<{
  buckets: StatBucket[]
  color?: 'cyan' | 'emerald' | 'gold'
  /** Форматирование подписей оси Y и значения над баром. */
  formatAxisValue?: (value: number) => string
  ariaLabel?: string
  /** Заголовок колонки значения в скрытой таблице для скринридеров. */
  valueHeader?: string
  tableCaption?: string
}>(), {
  ariaLabel: 'Диаграмма. Выбирайте столбец стрелками влево и вправо',
  color: 'cyan',
  formatAxisValue: formatCompactNumber,
  tableCaption: 'Данные диаграммы',
  valueHeader: 'Значение',
})

const selectedIndex = defineModel<number>('selectedIndex', { required: true })

// Классы фиксированными строками — UnoCSS собирает утилиты из исходников
// и динамическую интерполяцию вида `fill-${color}-500` не увидит.
const BAR_COLORS: Record<NonNullable<typeof props.color>, { idle: string, selected: string }> = {
  cyan: { idle: 'fill-cyan-300/40 group-hover:fill-cyan-300/65', selected: 'fill-cyan-300' },
  emerald: { idle: 'fill-emerald-300/40 group-hover:fill-emerald-300/65', selected: 'fill-emerald-300' },
  gold: { idle: 'fill-main-700 group-hover:fill-main-600', selected: 'fill-main-500' },
}

// Геометрия чарта: фиксированная высота, ширина — по контейнеру (без
// preserveAspectRatio-искажений скруглённые вершины баров остаются 4px).
const HEIGHT = 176
const PLOT_TOP = 22
const PLOT_BOTTOM = 148
const X_LABEL_Y = 166
const BAR_MAX_WIDTH = 24
const BAR_RADIUS = 4

const wrapperEl = useTemplateRef('wrapperEl')
const { width } = useElementSize(wrapperEl)

const maxValue = computed(() => niceCeil(Math.max(...props.buckets.map(bucket => bucket.value), 0)))

interface BarGeometry {
  bucket: StatBucket
  index: number
  bandX: number
  bandWidth: number
  centerX: number
  path: string
  showLabel: boolean
}

const bars = computed<BarGeometry[]>(() => {
  const count = props.buckets.length
  if (!count || width.value <= 0)
    return []

  const bandWidth = width.value / count
  const barWidth = Math.max(3, Math.min(BAR_MAX_WIDTH, bandWidth - 4))
  // Подписи оси X прореживаются на плотных сериях, якорь — последняя корзина.
  const labelStep = count > 24 ? 5 : count > 12 ? 2 : 1

  return props.buckets.map((bucket, index) => {
    const bandX = bandWidth * index
    const x = bandX + (bandWidth - barWidth) / 2
    let top = PLOT_BOTTOM - (bucket.value / maxValue.value) * (PLOT_BOTTOM - PLOT_TOP)
    if (bucket.value > 0)
      top = Math.min(top, PLOT_BOTTOM - 2)

    return {
      bandX,
      bandWidth,
      bucket,
      centerX: x + barWidth / 2,
      index,
      path: bucket.value > 0 ? roundedTopBarPath(x, barWidth, top, PLOT_BOTTOM) : '',
      showLabel: (count - 1 - index) % labelStep === 0,
    }
  })
})

// Бар растёт от базовой линии: скругление только у вершины (data end),
// у baseline углы прямые.
function roundedTopBarPath(x: number, barWidth: number, top: number, bottom: number) {
  const radius = Math.min(BAR_RADIUS, barWidth / 2, bottom - top)
  return [
    `M${x},${bottom}`,
    `V${top + radius}`,
    `Q${x},${top} ${x + radius},${top}`,
    `H${x + barWidth - radius}`,
    `Q${x + barWidth},${top} ${x + barWidth},${top + radius}`,
    `V${bottom}`,
    'Z',
  ].join(' ')
}

const gridlines = computed(() => [
  { label: props.formatAxisValue(maxValue.value), y: PLOT_TOP },
  { label: props.formatAxisValue(maxValue.value / 2), y: (PLOT_TOP + PLOT_BOTTOM) / 2 },
])

const selectedBar = computed(() => bars.value[selectedIndex.value])

// Подпись значения над выбранным баром прижимается к краям чарта,
// чтобы не обрезаться на крайних корзинах.
const selectedLabelX = computed(() => {
  if (!selectedBar.value)
    return 0
  return Math.min(Math.max(selectedBar.value.centerX, 28), width.value - 28)
})

const selectedLabelY = computed(() => {
  const bar = selectedBar.value
  if (!bar || !bar.path)
    return PLOT_BOTTOM - 7
  const top = PLOT_BOTTOM - (bar.bucket.value / maxValue.value) * (PLOT_BOTTOM - PLOT_TOP)
  return Math.min(top, PLOT_BOTTOM - 2) - 7
})

function moveSelection(delta: number) {
  const next = selectedIndex.value + delta
  if (next >= 0 && next < props.buckets.length)
    selectedIndex.value = next
}
</script>

<template>
  <div
    ref="wrapperEl"
    :aria-label="ariaLabel"
    class="select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
    role="group"
    tabindex="0"
    @keydown.left.prevent="moveSelection(-1)"
    @keydown.right.prevent="moveSelection(1)"
  >
    <svg v-if="bars.length" aria-hidden="true" class="block" :height="HEIGHT" :width="width">
      <!-- Сетка: тонкие линии, компактные подписи над ними у правого края -->
      <g v-for="line in gridlines" :key="line.y">
        <line class="stroke-white/8" stroke-width="1" x1="0" :x2="width" :y1="line.y" :y2="line.y" />
        <text class="fill-white/35 text-[10px] font-700" text-anchor="end" :x="width - 2" :y="line.y - 4">
          {{ line.label }}
        </text>
      </g>
      <line class="stroke-white/15" stroke-width="1" x1="0" :x2="width" :y1="PLOT_BOTTOM" :y2="PLOT_BOTTOM" />

      <g v-for="bar in bars" :key="bar.bucket.key" class="group cursor-pointer">
        <path
          v-if="bar.path"
          class="transition-colors duration-150"
          :class="bar.index === selectedIndex ? BAR_COLORS[color].selected : BAR_COLORS[color].idle"
          :d="bar.path"
        />
        <text
          v-if="bar.showLabel"
          class="text-[10px] font-700 transition-colors duration-150"
          :class="bar.index === selectedIndex ? 'fill-white/80' : 'fill-white/35'"
          text-anchor="middle"
          :x="bar.centerX"
          :y="X_LABEL_Y"
        >
          {{ bar.bucket.label }}
        </text>
        <!-- Хит-таргет шире и выше самого бара: вся полоса корзины -->
        <rect
          fill="transparent"
          :height="X_LABEL_Y"
          :width="bar.bandWidth"
          :x="bar.bandX"
          y="0"
          @pointerdown="selectedIndex = bar.index"
        />
      </g>

      <!-- Значение — только над выбранным баром (селективная подпись) -->
      <text
        v-if="selectedBar"
        class="fill-white text-[11px] font-900"
        text-anchor="middle"
        :x="selectedLabelX"
        :y="selectedLabelY"
      >
        {{ selectedBar.bucket.value > 0 ? formatAxisValue(selectedBar.bucket.value) : '0' }}
      </text>
    </svg>
    <div v-else class="h-44" />

    <!-- Данные диаграммы для скринридеров -->
    <table class="sr-only">
      <caption>{{ tableCaption }}</caption>
      <thead>
        <tr>
          <th scope="col">
            Период
          </th>
          <th scope="col">
            {{ valueHeader }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="bucket in buckets" :key="bucket.key">
          <td>{{ bucket.fullLabel }}</td>
          <td>{{ formatAxisValue(bucket.value) }}{{ bucket.hint ? ` · ${bucket.hint}` : '' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
