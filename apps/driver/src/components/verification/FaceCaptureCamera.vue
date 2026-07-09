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

// Что бы мы ни просили в constraints, вебвью (и Telegram, и Safari) отдаёт
// ЛАНДШАФТНЫЙ кадр родного режима сенсора — 1280x720 или 640x480. Картинка при
// этом ориентирована правильно, лицо ровное: это ландшафтная РАМКА, а не
// повёрнутый кадр, поэтому доворачивать его на 90° нельзя.
//
// Растянуть такой кадр «cover» на весь экран 9:19.5 нельзя тоже: от него
// останется четверть ширины, и камера выглядит приближенной в четыре раза.
// Поэтому ведём себя как системная камера: кадр обрезаем максимум до
// вертикального 3:4, целиком вписываем в экран, а сверху/снизу остаются чёрные
// поля под памятку и затвор. Никакого зума — только обрезка боков.
const TARGET_AR = 3 / 4

// Овал — доля от области превью, а не от вьюпорта: иначе на разных
// соотношениях сторон он то вылезал за кадр, то болтался в его центре.
const OVAL_WIDTH_FRAC = 0.72
const OVAL_ASPECT = 1.3
const OVAL_CENTER_Y = 0.47
// Сколько подряд удачных детекций нужно до снимка (~0.3с на тик).
const REQUIRED_STABLE_TICKS = 4

// Область превью на экране (px) и видимая часть кадра в координатах источника.
// Один и тот же crop используют превью, детектор и снимок, поэтому в поддержку
// уезжает ровно то, что водитель видел в овале.
const boxStyle = ref<Record<string, string>>({})
const videoStyle = ref<Record<string, string>>({})
const box = ref({ h: 0, w: 0 })
const crop = ref({ h: 0, w: 0, x: 0, y: 0 })

const oval = computed(() => {
  const w = box.value.w * OVAL_WIDTH_FRAC
  const h = Math.min(box.value.h * 0.9, w * OVAL_ASPECT)
  return { h, w }
})

function resetFrame() {
  box.value = { h: 0, w: 0 }
  crop.value = { h: 0, w: 0, x: 0, y: 0 }
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
    // Метаданных ещё нет — уточним по loadedmetadata/resize.
    resetFrame()
    boxStyle.value = { height: `${vh}px`, left: '0px', top: '0px', width: `${vw}px` }
    videoStyle.value = { height: `${vh}px`, left: '0px', top: '0px', transform: 'scaleX(-1)', width: `${vw}px` }
    return
  }

  // Кадр уже вертикальнее, чем 3:4? Тогда не режем вовсе — показываем как есть.
  const previewAR = Math.min(sw / sh, TARGET_AR)
  const cropW = Math.min(sw, sh * previewAR)
  const cropH = sh
  crop.value = { h: cropH, w: cropW, x: (sw - cropW) / 2, y: 0 }

  // Превью целиком вписываем в экран — «contain», без обрезки по высоте.
  let boxW = vw
  let boxH = boxW / previewAR
  if (boxH > vh) {
    boxH = vh
    boxW = boxH * previewAR
  }
  box.value = { h: boxH, w: boxW }
  boxStyle.value = {
    height: `${Math.round(boxH)}px`,
    left: `${Math.round((vw - boxW) / 2)}px`,
    top: `${Math.round((vh - boxH) / 2)}px`,
    width: `${Math.round(boxW)}px`,
  }

  // Габариты <video> задаём в px, а кроп делаем отрицательным сдвигом внутри
  // box с overflow-hidden: object-fit на <video> с CSS transform Telegram-вебвью
  // местами игнорирует, и превью рисовалось узкой полосой.
  const scale = boxW / cropW
  videoStyle.value = {
    height: `${Math.ceil(sh * scale)}px`,
    left: `${Math.round(-crop.value.x * scale)}px`,
    top: '0px',
    // Зеркалим, как привычное селфи. Кроп симметричен, поэтому сдвиг не ломает.
    transform: 'scaleX(-1)',
    width: `${Math.ceil(sw * scale)}px`,
  }
}

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
    // Просим самый широкий родной режим 4:3 и НЕ навязываем портрет: узкий
    // aspectRatio вебвью отрабатывает обрезкой сенсора, то есть сам по себе
    // добавляет зум. Ориентацию кадра разбирает вёрстка (см. fitVideo).
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', height: { ideal: 960 }, width: { ideal: 1280 } },
    })
  }
  catch {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } })
    }
    catch {
      // Нет разрешения/камеры — не блокируем водителя, отдаём системный фолбэк.
      bailToFallback()
      return
    }
  }

  const video = videoRef.value
  if (!video || !props.open) {
    stop()
    return
  }
  video.srcObject = stream
  fitVideo()
  // videoWidth/videoHeight появляются на loadedmetadata и меняются на resize
  // (например, после applyConstraints ниже) — пересчитываем кроп на обоих.
  video.onloadedmetadata = fitVideo
  video.onresize = fitVideo
  window.addEventListener('resize', fitVideo)
  window.addEventListener('orientationchange', fitVideo)

  // Если трек умеет аппаратный zoom (iOS 17+, часть Android) — принудительно
  // ставим минимальный: иначе камера открывается уже приближенной.
  try {
    const track = stream.getVideoTracks()[0]
    const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min?: number } }
    if (track && caps.zoom?.min !== undefined)
      await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] } as unknown as MediaTrackConstraints)
  }
  catch {
    // zoom не поддерживается — не критично, кадр просто останется как есть.
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
      if (faceInsideOval(faces)) {
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

// Лицо считается «в овале», когда его центр попал внутрь овала (с запасом) и
// само лицо сопоставимо с овалом по ширине — не силуэт в углу и не человек в
// трёх метрах. Пороги считаем от ВИДИМОГО кропа, а не от всего кадра: иначе
// на широком 16:9-стриме лицо, заполняющее овал, — это доли процента кадра, и
// детектор не срабатывает никогда.
function faceInsideOval(faces: Array<{ boundingBox: DOMRectReadOnly }>) {
  if (!faces.length)
    return false
  const c = crop.value
  if (!c.w || !c.h || !box.value.h)
    return false

  const face = faces[0].boundingBox
  // Нормируем на видимую область: 0..1 по её ширине/высоте.
  const cx = (face.x + face.width / 2 - c.x) / c.w
  const cy = (face.y + face.height / 2 - c.y) / c.h

  const rx = oval.value.w / box.value.w / 2
  const ry = oval.value.h / box.value.h / 2

  // Центр лица — в средних 60% овала: так лицо стоит по центру, а не у края.
  const dx = (cx - 0.5) / (rx * 0.6)
  const dy = (cy - OVAL_CENTER_Y) / (ry * 0.6)
  if (dx * dx + dy * dy > 1)
    return false

  // Ширина лица относительно ширины овала — обе в долях видимой ширины.
  const faceRatio = face.width / c.w / (rx * 2)
  return faceRatio >= 0.42 && faceRatio <= 1.2
}

async function snap(auto: boolean) {
  const video = videoRef.value
  const c = crop.value
  if (!video || !video.videoWidth || !c.w || !c.h)
    return
  // Режем ровно видимую область: снимок совпадает с превью, и поддержка
  // получает вертикальное фото, даже если камера отдала ландшафтный кадр.
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(c.w)
  canvas.height = Math.round(c.h)
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return
  ctx.drawImage(video, c.x, c.y, c.w, c.h, 0, 0, canvas.width, canvas.height)

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
  resetFrame()
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
    video.onresize = null
    video.srcObject = null
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-90 bg-black">
      <!-- Область превью: кадр вписан целиком, обрезаны только бока до 3:4.
           Габариты в px (см. fitVideo) — object-fit на <video> с transform
           Telegram-вебвью игнорирует. max-w-none отключает глобальный
           max-width:100% для video. -->
      <div class="absolute overflow-hidden" :style="boxStyle">
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
            maskImage: `radial-gradient(ellipse ${oval.w / 2}px ${oval.h / 2}px at 50% ${OVAL_CENTER_Y * 100}%, transparent 98%, black 100%)`,
            WebkitMaskImage: `radial-gradient(ellipse ${oval.w / 2}px ${oval.h / 2}px at 50% ${OVAL_CENTER_Y * 100}%, transparent 98%, black 100%)`,
          }"
        />

        <!-- Пунктирный овал + прогресс удержания -->
        <div
          class="pointer-events-none absolute left-1/2 border-3 rounded-[50%] border-dashed transition-colors duration-300 -translate-x-1/2 -translate-y-1/2"
          :class="status === 'hold' || status === 'captured' ? 'border-emerald-400' : 'border-white/85 animate-pulse'"
          :style="{ width: `${oval.w}px`, height: `${oval.h}px`, top: `${OVAL_CENTER_Y * 100}%` }"
        />
        <!-- Заливка прогресса снизу овала -->
        <div
          v-if="holdProgress > 0 && manualPreview === ''"
          class="pointer-events-none absolute left-1/2 overflow-hidden rounded-[50%] -translate-x-1/2 -translate-y-1/2"
          :style="{ width: `${oval.w}px`, height: `${oval.h}px`, top: `${OVAL_CENTER_Y * 100}%` }"
        >
          <div
            class="absolute inset-x-0 bottom-0 bg-emerald-400/25 transition-all duration-200"
            :style="{ height: `${holdProgress}%` }"
          />
        </div>
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
