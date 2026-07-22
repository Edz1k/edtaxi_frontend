<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

// Полноэкранный редактор фото перед загрузкой: перетаскивание, зум (пинч /
// колесо / слайдер) и поворот на 90°, чтобы пользователь подогнал снимок по
// центру кадра. На выходе — JPEG нужного размера (canvas), независимо от
// исходного формата (в т.ч. HEIC с айфона, который бэкенд не принимает).
const props = withDefaults(defineProps<{
  // Файл для редактирования; null — модалка скрыта.
  file: File | null
  // Соотношение сторон кадра (ширина/высота): 1 — аватар, 3/4 — документы.
  aspect?: number
  // Длинная сторона результата в пикселях.
  outputSize?: number
  // Круглая маска поверх кадра (для аватарок).
  round?: boolean
  title?: string
}>(), {
  aspect: 1,
  outputSize: 1024,
  round: false,
  title: 'Подгоните фото',
})

const emit = defineEmits<{
  cancel: []
  done: [file: File]
}>()

const viewportEl = ref<HTMLElement | null>(null)
const imageUrl = ref('')
const isLoading = ref(false)
const isExporting = ref(false)
const loadError = ref('')

let image: HTMLImageElement | null = null

const zoom = ref(1)
const rotation = ref(0) // 0 | 90 | 180 | 270
const offsetX = ref(0)
const offsetY = ref(0)

const MIN_ZOOM = 1
const MAX_ZOOM = 4

// Размер вьюпорта в px — меряем по факту (адаптивная ширина).
const viewportW = ref(0)
const viewportH = ref(0)

function measureViewport() {
  const el = viewportEl.value
  if (!el)
    return
  viewportW.value = el.clientWidth
  viewportH.value = el.clientHeight
}

// Габариты картинки с учётом поворота (шаги по 90° — оси просто меняются).
function rotatedSize() {
  if (!image)
    return { h: 1, w: 1 }
  const swapped = rotation.value % 180 !== 0
  return {
    h: swapped ? image.naturalWidth : image.naturalHeight,
    w: swapped ? image.naturalHeight : image.naturalWidth,
  }
}

// Базовый масштаб «cover»: при zoom=1 фото полностью закрывает кадр.
const baseScale = computed(() => {
  const { h, w } = rotatedSize()
  if (!viewportW.value || !viewportH.value || !w || !h)
    return 1
  // Пересчёт зависит от rotation через rotatedSize.
  void rotation.value
  return Math.max(viewportW.value / w, viewportH.value / h)
})

// Не даём укатить фото за края кадра.
function clampOffsets() {
  const { h, w } = rotatedSize()
  const scale = baseScale.value * zoom.value
  const maxX = Math.max(0, (w * scale - viewportW.value) / 2)
  const maxY = Math.max(0, (h * scale - viewportH.value) / 2)
  offsetX.value = Math.min(maxX, Math.max(-maxX, offsetX.value))
  offsetY.value = Math.min(maxY, Math.max(-maxY, offsetY.value))
}

const imageStyle = computed(() => {
  if (!image)
    return {}
  const scale = baseScale.value * zoom.value
  return {
    height: `${image.naturalHeight}px`,
    transform: `translate(-50%, -50%) translate(${offsetX.value}px, ${offsetY.value}px) rotate(${rotation.value}deg) scale(${scale})`,
    width: `${image.naturalWidth}px`,
  }
})

function resetView() {
  zoom.value = 1
  rotation.value = 0
  offsetX.value = 0
  offsetY.value = 0
}

function rotate() {
  rotation.value = (rotation.value + 90) % 360
  clampOffsets()
}

function setZoom(next: number) {
  zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
  clampOffsets()
}

// ===== Жесты: пан одним пальцем/мышью, пинч двумя, зум колесом =====

const pointers = new Map<number, { x: number, y: number }>()
let pinchStartDistance = 0
let pinchStartZoom = 1

function pointerDistance() {
  const [a, b] = [...pointers.values()]
  if (!a || !b)
    return 0
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function onPointerDown(event: PointerEvent) {
  viewportEl.value?.setPointerCapture(event.pointerId)
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointers.size === 2) {
    pinchStartDistance = pointerDistance()
    pinchStartZoom = zoom.value
  }
}

function onPointerMove(event: PointerEvent) {
  const previous = pointers.get(event.pointerId)
  if (!previous)
    return
  const current = { x: event.clientX, y: event.clientY }
  pointers.set(event.pointerId, current)

  if (pointers.size === 1) {
    offsetX.value += current.x - previous.x
    offsetY.value += current.y - previous.y
    clampOffsets()
    return
  }

  if (pointers.size === 2 && pinchStartDistance > 0)
    setZoom(pinchStartZoom * (pointerDistance() / pinchStartDistance))
}

function onPointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId)
  if (pointers.size < 2)
    pinchStartDistance = 0
}

function onWheel(event: WheelEvent) {
  event.preventDefault()
  setZoom(zoom.value * (1 - event.deltaY * 0.0015))
}

// ===== Загрузка исходника и экспорт =====

function releaseImage() {
  if (imageUrl.value)
    URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
  image = null
}

watch(() => props.file, (file) => {
  releaseImage()
  resetView()
  loadError.value = ''
  if (!file)
    return

  isLoading.value = true
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    image = img
    imageUrl.value = url
    isLoading.value = false
    requestAnimationFrame(() => {
      measureViewport()
      clampOffsets()
    })
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    isLoading.value = false
    loadError.value = 'Не удалось открыть это изображение. Попробуйте другое фото.'
  }
  img.src = url
})

onBeforeUnmount(releaseImage)

async function confirm() {
  if (!image || isExporting.value)
    return
  isExporting.value = true

  try {
    const aspect = props.aspect
    const outW = aspect >= 1 ? props.outputSize : Math.round(props.outputSize * aspect)
    const outH = aspect >= 1 ? Math.round(props.outputSize / aspect) : props.outputSize

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx)
      throw new Error('canvas 2d unavailable')

    // Те же трансформации, что в превью, отмасштабированные под выходной размер.
    const factor = outW / viewportW.value
    const drawScale = baseScale.value * zoom.value * factor

    ctx.fillStyle = '#0f1319'
    ctx.fillRect(0, 0, outW, outH)
    ctx.translate(outW / 2 + offsetX.value * factor, outH / 2 + offsetY.value * factor)
    ctx.rotate((rotation.value * Math.PI) / 180)
    ctx.drawImage(
      image,
      (-image.naturalWidth * drawScale) / 2,
      (-image.naturalHeight * drawScale) / 2,
      image.naturalWidth * drawScale,
      image.naturalHeight * drawScale,
    )

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob)
      throw new Error('failed to encode image')

    emit('done', new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
  }
  catch {
    loadError.value = 'Не удалось обработать фото. Попробуйте другое изображение.'
  }
  finally {
    isExporting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="file"
      class="fixed inset-0 z-[95] flex flex-col app-sheet text-white backdrop-blur-sm"
    >
      <!-- Шапка -->
      <div class="flex items-center justify-between px-4 pb-2 pt-[calc(var(--app-safe-area-top,0px)+0.9rem)]">
        <h2 class="text-base font-950">
          {{ title }}
        </h2>
        <button
          aria-label="Закрыть редактор"
          class="h-10 w-10 flex items-center justify-center rounded-full app-chip transition active:scale-95"
          type="button"
          @click="emit('cancel')"
        >
          <span class="i-mdi-close text-5" />
        </button>
      </div>

      <!-- Кадр -->
      <div class="min-h-0 flex flex-1 items-center justify-center px-5 py-3">
        <div
          ref="viewportEl"
          class="relative w-full max-w-sm touch-none select-none overflow-hidden border border-white/15 rounded-2xl bg-black/60"
          :style="{ aspectRatio: String(aspect) }"
          @pointercancel="onPointerUp"
          @pointerdown.prevent="onPointerDown"
          @pointermove.prevent="onPointerMove"
          @pointerup="onPointerUp"
          @wheel="onWheel"
        >
          <img
            v-if="imageUrl"
            alt=""
            class="pointer-events-none absolute left-1/2 top-1/2 max-w-none origin-center"
            draggable="false"
            :src="imageUrl"
            :style="imageStyle"
          >

          <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center">
            <span class="i-mdi-loading animate-spin text-8 app-accent" />
          </div>

          <!-- Круглая маска для аватарок: затемняем всё вне круга -->
          <div
            v-if="round && imageUrl"
            aria-hidden="true"
            class="pointer-events-none absolute inset-0"
            style="border-radius: 50%; box-shadow: 0 0 0 9999px rgba(5, 7, 11, 0.62)"
          />

          <!-- Сетка третей -->
          <div v-if="imageUrl" aria-hidden="true" class="pointer-events-none absolute inset-0 opacity-25">
            <div class="absolute inset-y-0 left-1/3 w-px bg-white" />
            <div class="absolute inset-y-0 left-2/3 w-px bg-white" />
            <div class="absolute inset-x-0 top-1/3 h-px bg-white" />
            <div class="absolute inset-x-0 top-2/3 h-px bg-white" />
          </div>
        </div>
      </div>

      <p v-if="loadError" class="px-6 text-center text-xs text-red-300 font-800">
        {{ loadError }}
      </p>

      <!-- Управление -->
      <div class="px-5 pb-[calc(var(--app-safe-area-bottom,0px)+1rem)] pt-2 space-y-3">
        <div class="flex items-center gap-3">
          <button
            aria-label="Повернуть на 90 градусов"
            class="h-11 w-11 flex shrink-0 items-center justify-center rounded-full app-chip transition active:scale-95"
            type="button"
            @click="rotate"
          >
            <span class="i-mdi-rotate-right text-5" />
          </button>

          <span class="i-mdi-magnify-minus-outline shrink-0 text-4.5 app-muted" aria-hidden="true" />
          <input
            aria-label="Масштаб"
            class="h-1.5 w-full appearance-none rounded-full bg-white/15 accent-main-500"
            :max="MAX_ZOOM"
            :min="MIN_ZOOM"
            step="0.01"
            type="range"
            :value="zoom"
            @input="setZoom(Number(($event.target as HTMLInputElement).value))"
          >
          <span class="i-mdi-magnify-plus-outline shrink-0 text-4.5 app-muted" aria-hidden="true" />

          <button
            aria-label="Сбросить изменения"
            class="h-11 w-11 flex shrink-0 items-center justify-center rounded-full app-chip transition active:scale-95"
            type="button"
            @click="resetView"
          >
            <span class="i-mdi-backup-restore text-5" />
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <button
            class="h-13 rounded-2xl app-chip text-sm font-900 transition active:scale-[0.98]"
            type="button"
            @click="emit('cancel')"
          >
            Отмена
          </button>
          <button
            :disabled="isLoading || isExporting || !imageUrl"
            class="h-13 rounded-2xl bg-main-500 text-sm text-white font-950 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="confirm"
          >
            {{ isExporting ? 'Сохраняем...' : 'Готово' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
