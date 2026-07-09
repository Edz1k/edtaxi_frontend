<script setup lang="ts">
// Живая камера для селфи-проверки: фронталка открывается ВНУТРИ приложения
// (никаких системных «камера/галерея»), лицо помещается в овал, и как только
// детектор стабильно видит лицо в овале — снимок делается автоматически.
// Где FaceDetector API недоступен (часть iOS/WebView) — остаётся живая камера
// с кнопкой-затвором и предпросмотром, галерея не открывается никогда.
// Если доступ к камере запрещён — эмитим fallback, родитель откроет системную
// камеру через input[capture], чтобы водитель не остался заблокированным.

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  capture: [file: File]
  fallback: []
  close: []
}>()

type Status = 'captured' | 'error' | 'hold' | 'manual' | 'searching' | 'starting'

const videoRef = ref<HTMLVideoElement | null>(null)
const status = ref<Status>('starting')
const hint = ref('Включаем камеру...')
// Прогресс удержания лица в овале (0..100) — заливка кольца перед снимком.
const holdProgress = ref(0)
// Предпросмотр в ручном режиме (нет детектора): подтвердить или переснять.
const manualPreview = ref('')
let manualFile: File | null = null

let stream: MediaStream | null = null
let detectTimer: ReturnType<typeof setInterval> | null = null
let stableTicks = 0

// Видео растягиваем вручную — размер в px по метаданным потока: на
// Telegram-вебвью (и Android, и iOS) object-fit на <video> с CSS transform
// местами игнорируется, и превью рисовалось узкой полосой.
//
// Ориентация: часть вебвью игнорирует запрошенный портрет 9:16 и отдаёт кадр
// в «сенсорной» ориентации — длинной стороной ГОРИЗОНТАЛЬНО (1280×720), хотя
// телефон вертикальный. Тогда доворачиваем кадр на 90° (и превью, и снимок —
// см. snap), а масштаб считаем по ДОВЁРНУТЫМ габаритам: длинная сторона кадра
// ложится на длинную сторону экрана, никаких полос.
//
// Масштаб — «cover с ограничителем»: обычный cover на весь экран (никаких
// чёрных рамок), но не больше чем contain×MAX_CROP_SCALE — чтобы квадратный
// 3:4-кадр не выглядел «приближенным в 2 раза» (останутся узкие поля).
const MAX_CROP_SCALE = 1.4
const videoStyle = ref<Record<string, string>>({})
const isRotated = ref(false)

function computeRotation() {
  const video = videoRef.value
  const sw = video?.videoWidth ?? 0
  const sh = video?.videoHeight ?? 0
  if (!sw || !sh) {
    isRotated.value = false
    return
  }
  const screenPortrait = window.innerHeight >= window.innerWidth
  const streamPortrait = sh >= sw
  isRotated.value = screenPortrait !== streamPortrait
}

function fitVideo() {
  const video = videoRef.value
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!vw || !vh)
    return

  const sw = video?.videoWidth ?? 0
  const sh = video?.videoHeight ?? 0
  if (!sw || !sh) {
    // Метаданных ещё нет — пока просто на весь экран; уточним по loadedmetadata.
    videoStyle.value = { height: `${vh}px`, left: '0px', top: '0px', transform: 'scaleX(-1)', width: `${vw}px` }
    return
  }

  computeRotation()

  // Эффективные габариты — какими кадр ЛЯЖЕТ на экран (с учётом доворота).
  const effW = isRotated.value ? sh : sw
  const effH = isRotated.value ? sw : sh

  const coverScale = Math.max(vw / effW, vh / effH)
  const containScale = Math.min(vw / effW, vh / effH)
  const scale = Math.min(coverScale, containScale * MAX_CROP_SCALE)

  // Бокс элемента — в «сырых» габаритах кадра; rotate вокруг центра сам
  // меняет визуальные стороны местами, центр при этом не сдвигается.
  const width = Math.ceil(sw * scale)
  const height = Math.ceil(sh * scale)
  videoStyle.value = {
    height: `${height}px`,
    left: `${Math.round((vw - width) / 2)}px`,
    top: `${Math.round((vh - height) / 2)}px`,
    // Зеркалим, как привычное селфи; при несовпадении ориентаций — доворот.
    transform: isRotated.value ? 'scaleX(-1) rotate(90deg)' : 'scaleX(-1)',
    width: `${width}px`,
  }
}

// Овал в центре экрана: доля от меньшей стороны вьюпорта.
const OVAL_WIDTH_VMIN = 68
const OVAL_HEIGHT_VMIN = 88
// Сколько подряд удачных детекций нужно до снимка (~0.3с на тик).
const REQUIRED_STABLE_TICKS = 4

watch(() => props.open, (open) => {
  if (open)
    start()
  else
    stop()
})

onBeforeUnmount(stop)

async function start() {
  status.value = 'starting'
  hint.value = 'Включаем камеру...'
  holdProgress.value = 0
  stableTicks = 0
  clearManualPreview()

  if (!navigator.mediaDevices?.getUserMedia) {
    bailToFallback()
    return
  }

  try {
    // 9:16 вместо дефолтных 3:4 сенсора: портретный стрим почти совпадает с
    // экраном, и object-cover почти не режет кадр по бокам — без этого камера
    // выглядела «приближенной в 2 раза» и лицо не влезало в овал.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 720 },
        height: { ideal: 1280 },
        aspectRatio: { ideal: 9 / 16 },
      },
    })
  }
  catch {
    // Нет разрешения/камеры — не блокируем водителя, отдаём системный фолбэк.
    bailToFallback()
    return
  }

  const video = videoRef.value
  if (!video || !props.open) {
    stop()
    return
  }
  video.srcObject = stream
  fitVideo()
  video.onloadedmetadata = fitVideo
  window.addEventListener('resize', fitVideo)
  window.addEventListener('orientationchange', fitVideo)

  // Третий слой против «приближенной» камеры: если трек умеет аппаратный
  // zoom (iOS 17+, часть Android) — принудительно ставим минимальный.
  try {
    const track = stream.getVideoTracks()[0]
    const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min?: number } }
    if (track && caps.zoom?.min !== undefined)
      await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] } as unknown as MediaTrackConstraints)
  }
  catch {
    // zoom не поддерживается — не критично, contain уже сохраняет полный кадр.
  }

  try {
    await video.play()
  }
  catch {
    // play() падает только при закрытии — камера уже останавливается.
  }
  fitVideo()

  startDetection()
}

function startDetection() {
  const FaceDetectorCtor = (window as any).FaceDetector
  if (!FaceDetectorCtor) {
    // Детектора нет: живая камера с ручным затвором (но НЕ галерея).
    status.value = 'manual'
    hint.value = 'Поместите лицо в овал и нажмите кнопку'
    return
  }

  let detector: any
  try {
    detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 })
  }
  catch {
    status.value = 'manual'
    hint.value = 'Поместите лицо в овал и нажмите кнопку'
    return
  }

  status.value = 'searching'
  hint.value = 'Поместите лицо в овал'

  detectTimer = setInterval(async () => {
    const video = videoRef.value
    if (!video || video.readyState < 2 || status.value === 'captured')
      return
    try {
      const faces = await detector.detect(video)
      if (faceInsideOval(faces, video)) {
        stableTicks++
        status.value = 'hold'
        hint.value = 'Отлично! Не двигайтесь...'
        holdProgress.value = Math.min(100, Math.round((stableTicks / REQUIRED_STABLE_TICKS) * 100))
        if (stableTicks >= REQUIRED_STABLE_TICKS) {
          status.value = 'captured'
          hint.value = 'Снимок сделан'
          await snap(true)
        }
      }
      else {
        stableTicks = 0
        holdProgress.value = 0
        if (status.value !== 'searching') {
          status.value = 'searching'
          hint.value = 'Лицо не обнаружено — поместите лицо в овал'
        }
      }
    }
    catch {
      // Детектор объявлен, но не работает (без модели) — ручной режим.
      stopDetection()
      status.value = 'manual'
      hint.value = 'Поместите лицо в овал и нажмите кнопку'
    }
  }, 300)
}

// Лицо считается «в овале», когда его центр внутри центральной зоны кадра и
// оно достаточно крупное (не силуэт в углу и не человек в трёх метрах).
// Пороги подобраны под 9:16-стрим (более широкое поле зрения): лицо на
// комфортной дистанции занимает меньшую долю кадра, чем при 3:4.
function faceInsideOval(faces: Array<{ boundingBox: DOMRectReadOnly }>, video: HTMLVideoElement) {
  if (!faces.length)
    return false
  const box = faces[0].boundingBox
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh)
    return false
  const cx = (box.x + box.width / 2) / vw
  const cy = (box.y + box.height / 2) / vh
  const sizeOK = box.width >= vw * 0.16 && box.width <= vw * 0.9
  return sizeOK && cx > 0.25 && cx < 0.75 && cy > 0.18 && cy < 0.75
}

async function snap(auto: boolean) {
  const video = videoRef.value
  if (!video || !video.videoWidth)
    return
  const canvas = document.createElement('canvas')
  const ctx = (() => {
    if (isRotated.value) {
      // Кадр пришёл боком (сенсорная ориентация) — снимок доворачиваем на те
      // же 90°, что и превью: поддержка получает вертикальное фото, а не лежачее.
      canvas.width = video.videoHeight
      canvas.height = video.videoWidth
      const context = canvas.getContext('2d')
      if (!context)
        return null
      context.translate(canvas.width / 2, canvas.height / 2)
      context.rotate(Math.PI / 2)
      context.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2)
      return context
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context)
      return null
    context.drawImage(video, 0, 0)
    return context
  })()
  if (!ctx)
    return

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92))
  if (!blob)
    return
  const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })

  if (auto) {
    // Автоснимок по детекции лица — сразу используем.
    emit('capture', file)
    emit('close')
    return
  }
  // Ручной режим: показываем предпросмотр — «Использовать» или «Переснять».
  manualFile = file
  manualPreview.value = URL.createObjectURL(blob)
}

function confirmManual() {
  if (!manualFile)
    return
  emit('capture', manualFile)
  emit('close')
}

function retakeManual() {
  clearManualPreview()
  hint.value = 'Поместите лицо в овал и нажмите кнопку'
}

function clearManualPreview() {
  if (manualPreview.value)
    URL.revokeObjectURL(manualPreview.value)
  manualPreview.value = ''
  manualFile = null
}

function bailToFallback() {
  emit('fallback')
  emit('close')
}

function stopDetection() {
  if (detectTimer) {
    clearInterval(detectTimer)
    detectTimer = null
  }
}

function stop() {
  stopDetection()
  stableTicks = 0
  holdProgress.value = 0
  clearManualPreview()
  window.removeEventListener('resize', fitVideo)
  window.removeEventListener('orientationchange', fitVideo)
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
  const video = videoRef.value
  if (video) {
    video.onloadedmetadata = null
    video.srcObject = null
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-90 bg-black">
      <!-- Живое видео: габариты «contain» считаются в px (см. fitVideo) —
           object-fit на <video> с transform Telegram-вебвью игнорирует
           (превью рисовалось узкой полосой), поэтому размер задаём явно.
           max-w-none отключает глобальный max-width:100% для video. -->
      <video
        ref="videoRef"
        autoplay
        class="absolute max-w-none"
        muted
        playsinline
        :style="videoStyle"
      />

      <!-- Затемнение всего, кроме овала -->
      <div
        class="pointer-events-none absolute inset-0"
        :style="{
          background: 'rgba(0,0,0,0.62)',
          maskImage: `radial-gradient(ellipse ${OVAL_WIDTH_VMIN / 2}vmin ${OVAL_HEIGHT_VMIN / 2}vmin at 50% 46%, transparent 98%, black 100%)`,
          WebkitMaskImage: `radial-gradient(ellipse ${OVAL_WIDTH_VMIN / 2}vmin ${OVAL_HEIGHT_VMIN / 2}vmin at 50% 46%, transparent 98%, black 100%)`,
        }"
      />

      <!-- Пунктирный овал + прогресс удержания -->
      <div
        class="pointer-events-none absolute left-1/2 top-[46%] border-3 rounded-[50%] border-dashed transition-colors duration-300 -translate-x-1/2 -translate-y-1/2"
        :class="status === 'hold' || status === 'captured' ? 'border-emerald-400' : 'border-white/85 animate-pulse'"
        :style="{ width: `${OVAL_WIDTH_VMIN}vmin`, height: `${OVAL_HEIGHT_VMIN}vmin` }"
      />
      <!-- Заливка прогресса снизу овала -->
      <div
        v-if="holdProgress > 0 && manualPreview === ''"
        class="pointer-events-none absolute left-1/2 top-[46%] overflow-hidden rounded-[50%] -translate-x-1/2 -translate-y-1/2"
        :style="{ width: `${OVAL_WIDTH_VMIN}vmin`, height: `${OVAL_HEIGHT_VMIN}vmin` }"
      >
        <div
          class="absolute inset-x-0 bottom-0 bg-emerald-400/25 transition-all duration-200"
          :style="{ height: `${holdProgress}%` }"
        />
      </div>

      <!-- Памятка (как в Я.Про) -->
      <div class="pointer-events-none absolute inset-x-0 top-0 pt-[calc(var(--app-safe-area-top)+3.5rem)]">
        <div class="mx-auto max-w-sm px-6">
          <p class="text-lg text-white font-950">
            Проверка личности
          </p>
          <ul class="mt-1.5 text-xs text-white/75 leading-5">
            <li>— Найдите место с хорошим освещением.</li>
            <li>— Снимите маску и тёмные очки.</li>
            <li>— Держите телефон на уровне лица.</li>
          </ul>
        </div>
      </div>

      <!-- Статус-подсказка -->
      <div class="pointer-events-none absolute inset-x-0 bottom-36 px-6 text-center">
        <p
          class="mx-auto inline-block rounded-full px-4 py-2 text-sm font-900"
          :class="status === 'hold' || status === 'captured'
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-black/55 text-white'"
        >
          {{ hint }}
        </p>
      </div>

      <!-- Ручной затвор (когда детектора лиц нет) -->
      <div v-if="status === 'manual' && !manualPreview" class="absolute inset-x-0 bottom-10 flex justify-center">
        <button
          aria-label="Сделать снимок"
          class="h-18 w-18 border-4 border-white rounded-full bg-white/25 transition active:scale-90"
          type="button"
          @click="snap(false)"
        />
      </div>

      <!-- Предпросмотр ручного снимка -->
      <div v-if="manualPreview" class="absolute inset-0 flex flex-col items-center justify-center bg-black/85 px-6">
        <img
          alt="Селфи"
          class="h-64 w-64 rounded-full object-cover shadow-2xl"
          :src="manualPreview"
        >
        <p class="mt-4 text-sm text-white/80 font-800">
          Лицо хорошо видно?
        </p>
        <div class="mt-4 flex gap-3">
          <button
            class="h-12 rounded-2xl bg-white/12 px-5 text-sm text-white font-900 transition active:scale-[0.97]"
            type="button"
            @click="retakeManual"
          >
            Переснять
          </button>
          <button
            class="h-12 rounded-2xl bg-main-500 px-6 text-sm font-950 transition active:scale-[0.97]"
            type="button"
            @click="confirmManual"
          >
            Использовать
          </button>
        </div>
      </div>

      <!-- Закрыть -->
      <button
        aria-label="Закрыть"
        class="absolute right-4 top-[calc(var(--app-safe-area-top)+0.75rem)] h-11 w-11 flex items-center justify-center rounded-full bg-black/55 text-white"
        type="button"
        @click="emit('close')"
      >
        <span class="i-mdi-close text-6" />
      </button>
    </div>
  </Teleport>
</template>
