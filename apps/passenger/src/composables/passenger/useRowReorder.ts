// Drag&drop пересортировка строк маршрута (А / остановки / Б) в форме адреса.
// Своя реализация на pointer-событиях без внешних зависимостей: список короткий
// (≤5 строк) и не скроллится, а свои touch-quirks у sortable-библиотек в
// Telegram-вебвью не окупают ~40 КБ. Тап (без долгого удержания) не мешает
// фокусу инпутов, кнопки строки (× / гео / карта) свои тапы сохраняют.

interface UseRowReorderOptions {
  // Актуальное число строк маршрута (А + остановки + Б).
  count: () => number
  // Перестановка: индексы — позиции в общем списке точек.
  onReorder: (from: number, to: number) => void
  // Порог удержания до старта драга и порог движения, отменяющего удержание.
  longPressMs?: number
}

interface TelegramHaptics {
  impactOccurred?: (style: string) => void
}

function triggerHaptic() {
  const app = window.Telegram?.WebApp as { HapticFeedback?: TelegramHaptics } | undefined
  app?.HapticFeedback?.impactOccurred?.('medium')
}

export function useRowReorder(options: UseRowReorderOptions) {
  const LONG_PRESS_MS = options.longPressMs ?? 450
  const MOVE_CANCEL_PX = 8
  const FALLBACK_PITCH = 62

  const rowEls: (HTMLElement | null)[] = []
  const dragIndex = ref<number | null>(null)
  const targetIndex = ref<number | null>(null)
  const dragOffsetY = ref(0)
  const isPressing = ref(false)

  let pressedIndex: number | null = null
  let startY = 0
  let pointerId = -1
  let rowPitch = FALLBACK_PITCH
  let pressTimer: number | undefined
  let capturedEl: HTMLElement | null = null

  function setRowEl(index: number, el: unknown) {
    rowEls[index] = (el as HTMLElement | null) ?? null
  }

  function clearTimer() {
    if (pressTimer !== undefined) {
      window.clearTimeout(pressTimer)
      pressTimer = undefined
    }
  }

  function teardown() {
    clearTimer()
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    if (capturedEl && pointerId !== -1) {
      try {
        capturedEl.releasePointerCapture(pointerId)
      }
      catch {}
    }
    capturedEl = null
  }

  function reset() {
    teardown()
    dragIndex.value = null
    targetIndex.value = null
    dragOffsetY.value = 0
    isPressing.value = false
    pressedIndex = null
    pointerId = -1
  }

  function beginDrag() {
    if (pressedIndex === null)
      return

    dragIndex.value = pressedIndex
    targetIndex.value = pressedIndex
    dragOffsetY.value = 0

    // Шаг между строками — из фактических позиций (fallback на типовую высоту).
    const first = rowEls[0]?.getBoundingClientRect().top
    const second = rowEls[1]?.getBoundingClientRect().top
    rowPitch = first != null && second != null && second > first ? second - first : FALLBACK_PITCH

    // Роняем клавиатуру/выделение, чтобы драг не конфликтовал с вводом.
    const active = document.activeElement as HTMLElement | null
    active?.blur?.()
    triggerHaptic()

    const el = rowEls[pressedIndex]
    if (el && pointerId !== -1) {
      try {
        el.setPointerCapture(pointerId)
        capturedEl = el
      }
      catch {}
    }
  }

  function onPointerDown(index: number, event: PointerEvent) {
    // Не мешаем кнопкам строки и обычному тапу-фокусу; драг — только когда есть
    // что переставлять (А + Б + хотя бы одна остановка).
    if ((event.target as HTMLElement).closest('button'))
      return
    if (options.count() < 3)
      return

    pressedIndex = index
    startY = event.clientY
    pointerId = event.pointerId
    isPressing.value = true

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    clearTimer()
    pressTimer = window.setTimeout(() => {
      pressTimer = undefined
      beginDrag()
    }, LONG_PRESS_MS)
  }

  function onPointerMove(event: PointerEvent) {
    if (pointerId !== -1 && event.pointerId !== pointerId)
      return

    // До старта драга заметное движение — это скролл/тап: отменяем удержание.
    if (dragIndex.value === null) {
      if (Math.abs(event.clientY - startY) > MOVE_CANCEL_PX)
        reset()
      return
    }

    event.preventDefault()
    dragOffsetY.value = event.clientY - startY
    const total = options.count()
    const steps = Math.round(dragOffsetY.value / rowPitch)
    targetIndex.value = Math.min(total - 1, Math.max(0, dragIndex.value + steps))
  }

  function onPointerUp(event: PointerEvent) {
    if (pointerId !== -1 && event.pointerId !== pointerId)
      return

    const from = dragIndex.value
    const to = targetIndex.value
    reset()
    if (from !== null && to !== null && from !== to)
      options.onReorder(from, to)
  }

  onBeforeUnmount(reset)

  // Инлайновый стиль строки: поднятая — плывёт за пальцем, соседи между исходной
  // и целевой позицией сдвигаются на шаг, освобождая место.
  function rowStyle(index: number): Record<string, string> {
    if (dragIndex.value === null || targetIndex.value === null)
      return {}

    if (index === dragIndex.value) {
      return {
        position: 'relative',
        transform: `translateY(${dragOffsetY.value}px) scale(1.02)`,
        zIndex: '20',
      }
    }

    const from = dragIndex.value
    const to = targetIndex.value
    let shift = 0
    if (from < to && index > from && index <= to)
      shift = -rowPitch
    else if (from > to && index >= to && index < from)
      shift = rowPitch

    return {
      transform: `translateY(${shift}px)`,
      transition: 'transform 150ms ease',
    }
  }

  return {
    dragIndex,
    isPressing,
    onPointerDown,
    rowStyle,
    setRowEl,
  }
}
