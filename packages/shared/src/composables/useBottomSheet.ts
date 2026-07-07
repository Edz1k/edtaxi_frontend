import type { MaybeRefOrGetter } from 'vue'
import { isTMA, swipeBehavior } from '@telegram-apps/sdk'
import { useElementSize, useEventListener, usePreferredReducedMotion } from '@vueuse/core'
import { computed, onMounted, onScopeDispose, ref, toValue, watch } from 'vue'

// Снап-точки пассажирской шторки. Набор точек и дефолт задаёт вызывающий
// компонент под текущее состояние (адрес / тарифы / поиск).
export type SheetSnap = 'peek' | 'half' | 'full'

interface UseBottomSheetOptions {
  /** Рамка доступной области (над таб-баром, под верхней плашкой) — задаёт maxHeight. */
  boundsEl: MaybeRefOrGetter<HTMLElement | null | undefined>
  /** Сама карточка шторки — на неё вешаем transitionend и биндим высоту. */
  sheetEl: MaybeRefOrGetter<HTMLElement | null | undefined>
  /** Зона перетаскивания (грабер + шапка). */
  handleEl: MaybeRefOrGetter<HTMLElement | null | undefined>
  /** Обёртка контента — её натуральная высота даёт content-fit для `half`. */
  contentEl: MaybeRefOrGetter<HTMLElement | null | undefined>
  /** Разрешённые снапы в текущем состоянии. */
  snaps: MaybeRefOrGetter<SheetSnap[]>
  initialSnap?: SheetSnap
}

// Порог скорости «броска» (px/ms): выше — снапим по направлению жеста, ниже — к ближайшей точке.
const FLING_VELOCITY = 0.4
// Сколько шторка «выглядывает» в свёрнутом состоянии сверх грабера.
const PEEK_EXTRA_PX = 72
// Нижний предел рабочей высоты, чтобы `half` не схлопывался под коротким контентом.
const MIN_HALF_PX = 200
// Вертикальные отступы контента (px) в content-fit: нижний паддинг обёртки +
// запас на бордеры/скругления/рендеринг шрифтов, чтобы нижняя кнопка не
// подрезалась краем шторки на реальных устройствах.
const CONTENT_PAD_PX = 24
// Смещение пальца, ниже которого жест считаем тапом (тап по граберу = раскрыть).
const TAP_PX = 6
// Длительность доводки после отпускания.
const SETTLE_MS = 300

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Логарифмическое сопротивление за пределами снапов («резина», приём из vaul):
// тянуть за границу можно, но чем дальше — тем туже; после отпускания шторка
// пружинит обратно к ближайшему снапу. Даёт «живой» drag вместо жёсткого стопа.
function resist(overshoot: number): number {
  return 10 * Math.log10(1 + Math.max(0, overshoot))
}

function withResistance(raw: number, min: number, max: number): number {
  if (raw < min)
    return min - resist(min - raw)
  if (raw > max)
    return max + resist(raw - max)
  return raw
}

export function useBottomSheet(options: UseBottomSheetOptions) {
  const reducedMotion = usePreferredReducedMotion()

  const { height: boundsHeight } = useElementSize(() => toValue(options.boundsEl))
  const { height: handleHeight } = useElementSize(() => toValue(options.handleEl))
  const { height: contentHeight } = useElementSize(() => toValue(options.contentEl))

  const active = ref<SheetSnap>(options.initialSnap ?? 'half')
  const height = ref(0)
  const dragging = ref(false)
  const transitioning = ref(false)

  const maxHeight = computed(() => Math.max(0, boundsHeight.value))
  const allowed = computed<SheetSnap[]>(() => {
    const list = toValue(options.snaps)
    return list.length ? list : ['half']
  })

  // Высота видимой части шторки для конкретного снапа.
  function visibleFor(snap: SheetSnap): number {
    const max = maxHeight.value
    if (max === 0)
      return 0
    if (snap === 'peek')
      return Math.min(handleHeight.value + PEEK_EXTRA_PX, max)
    if (snap === 'full')
      return max
    // half — подгоняем под контент, но не ниже MIN_HALF и не выше доступной высоты.
    const fit = handleHeight.value + contentHeight.value + CONTENT_PAD_PX
    return clamp(fit, Math.min(MIN_HALF_PX, max), max)
  }

  function snapPoints() {
    return allowed.value
      .map(snap => ({ snap, y: visibleFor(snap) }))
      .sort((a, b) => a.y - b.y)
  }

  // Ближайший разрешённый снап по высоте (когда просят недоступный в этом состоянии).
  function resolveSnap(snap: SheetSnap): SheetSnap {
    if (allowed.value.includes(snap))
      return snap
    const target = visibleFor(snap)
    return snapPoints().sort(
      (a, b) => Math.abs(a.y - target) - Math.abs(b.y - target),
    )[0]!.snap
  }

  function snapTo(snap: SheetSnap, { animate = true }: { animate?: boolean } = {}) {
    const target = resolveSnap(snap)
    active.value = target
    if (animate && reducedMotion.value !== 'reduce')
      transitioning.value = true
    height.value = visibleFor(target)
  }

  // Пока не тащим — держим высоту синхронной с активным снапом и размерами:
  // контент вырос/схлопнулся, сменился вьюпорт, поменялся набор снапов.
  watch([maxHeight, contentHeight, handleHeight, allowed], () => {
    if (!dragging.value && maxHeight.value > 0)
      snapTo(active.value, { animate: false })
  })

  let startPointerY = 0
  let startHeight = 0
  let moved = 0
  const samples: { t: number, y: number }[] = []

  function minVisible() {
    return Math.min(...allowed.value.map(visibleFor))
  }
  function maxVisible() {
    return Math.max(...allowed.value.map(visibleFor))
  }

  // Скорость по последним сэмплам (px/ms): >0 — палец идёт вверх, шторка растёт.
  function velocity(): number {
    if (samples.length < 2)
      return 0
    const last = samples[samples.length - 1]!
    let from = last
    for (let i = samples.length - 2; i >= 0; i--) {
      from = samples[i]!
      if (last.t - from.t >= 30)
        break
    }
    const dt = last.t - from.t
    return dt > 0 ? (last.y - from.y) / dt : 0
  }

  function resolveByVelocity(currentHeight: number, v: number): SheetSnap {
    const points = snapPoints()
    let idx = 0
    let best = Number.POSITIVE_INFINITY
    points.forEach((point, i) => {
      const distance = Math.abs(point.y - currentHeight)
      if (distance < best) {
        best = distance
        idx = i
      }
    })
    if (Math.abs(v) > FLING_VELOCITY)
      idx = v > 0 ? Math.min(points.length - 1, idx + 1) : Math.max(0, idx - 1)
    return points[idx]!.snap
  }

  // Тап по граберу: раскрываем на уровень выше; с самого верха — сворачиваем вниз.
  function nextSnapOnTap(): SheetSnap {
    const points = snapPoints()
    const currentIdx = points.findIndex(point => point.snap === active.value)
    return currentIdx < points.length - 1
      ? points[currentIdx + 1]!.snap
      : points[0]!.snap
  }

  function onPointerDown(event: PointerEvent) {
    if (!event.isPrimary)
      return
    dragging.value = true
    transitioning.value = false
    startPointerY = event.clientY
    startHeight = height.value
    moved = 0
    samples.length = 0
    samples.push({ t: event.timeStamp, y: startHeight })
    ;(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging.value)
      return
    const delta = startPointerY - event.clientY
    moved = Math.max(moved, Math.abs(delta))
    height.value = withResistance(startHeight + delta, minVisible(), maxVisible())
    samples.push({ t: event.timeStamp, y: height.value })
    if (samples.length > 6)
      samples.shift()
  }

  function onPointerUp() {
    if (!dragging.value)
      return
    dragging.value = false
    snapTo(moved < TAP_PX ? nextSnapOnTap() : resolveByVelocity(height.value, velocity()))
  }

  useEventListener(() => toValue(options.handleEl), 'pointerdown', onPointerDown)
  useEventListener(window, 'pointermove', onPointerMove)
  useEventListener(window, 'pointerup', onPointerUp)
  useEventListener(window, 'pointercancel', onPointerUp)
  useEventListener(() => toValue(options.sheetEl), 'transitionend', (event: TransitionEvent) => {
    if (event.propertyName === 'height')
      transitioning.value = false
  })

  const sheetStyle = computed(() => ({
    height: `${Math.round(height.value)}px`,
    transition: !dragging.value && transitioning.value && reducedMotion.value !== 'reduce'
      ? `height ${SETTLE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`
      : 'none',
  }))

  // В Telegram вертикальный свайп по WebView сворачивает мини-апп — гасим его,
  // пока шторка жива, и возвращаем поведение при размонтировании.
  let restoreSwipe: (() => void) | undefined
  onMounted(() => {
    if (!isTMA())
      return
    swipeBehavior.mount.ifAvailable()
    const wasEnabled = swipeBehavior.isVerticalEnabled()
    swipeBehavior.disableVertical.ifAvailable()
    if (wasEnabled)
      restoreSwipe = () => swipeBehavior.enableVertical.ifAvailable()
  })
  onScopeDispose(() => restoreSwipe?.())

  return {
    active,
    dragging,
    sheetStyle,
    snapTo,
  }
}
