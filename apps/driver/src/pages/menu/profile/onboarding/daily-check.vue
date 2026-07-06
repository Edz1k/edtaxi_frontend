<script setup lang="ts">
import PhotoEditorModal from '@edtaxi/shared/components/photo/PhotoEditorModal.vue'
import PhotoSourceSheet from '@edtaxi/shared/components/photo/PhotoSourceSheet.vue'
import { useAutoRefresh } from '@edtaxi/shared/composables/useAutoRefresh'
import AuthButton from '~/components/auth/AuthButton.vue'
import FaceCaptureCamera from '~/components/verification/FaceCaptureCamera.vue'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'

const router = useRouter()
const driver = useDriverOnboardingStore()

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    backTo: '/menu/profile/onboarding',
    screenSubtitle: 'Назад',
    screenTitle: 'Ежедневная проверка',
  },
})

useHead({
  title: 'Ежедневная проверка | EdTaxi Driver',
})

const selfieFile = ref<File | null>(null)
const selfiePreview = ref('')
const vehiclePhotoFile = ref<File | null>(null)
const vehiclePhotoPreview = ref('')

const vehicleId = computed(() => driver.verification?.vehicles[0]?.id ?? '')

const hasVehicle = computed(() => Boolean(vehicleId.value))

const canSubmit = computed(() =>
  hasVehicle.value && selfieFile.value !== null && vehiclePhotoFile.value !== null,
)

// Статус сегодняшней проверки: если уже отправлена (пройдена или на проверке) —
// показываем статус, а не форму. daily_check_valid покрывает approved+pending.
const latestDaily = computed(() => driver.verification?.latest_daily_check ?? null)
const dailyValid = computed(() => Boolean(driver.verification?.daily_check_valid))
const dailyPending = computed(() => dailyValid.value && latestDaily.value?.status === 'pending')
const dailyRejectionReason = computed(() =>
  !dailyValid.value && latestDaily.value?.status === 'rejected'
    ? latestDaily.value?.rejection_reason ?? ''
    : '',
)

onMounted(async () => {
  if (!driver.verification)
    await driver.loadVerification().catch(() => {})
})

// Пока дэйлик на проверке — вердикт поддержки подтягивается сам (поллинг +
// возврат на экран), без ручного перезахода.
useAutoRefresh(() => driver.loadVerification(), {
  enabled: computed(() => dailyPending.value),
  intervalMs: 12_000,
})

// Селфи снимается ТОЛЬКО живой камерой внутри приложения (овал + автоснимок по
// детекции лица) — системный выбор файла открывал на Android галерею, что для
// ежедневной проверки недопустимо. Системный input остаётся только фолбэком,
// когда доступ к камере запрещён.
const isCameraOpen = ref(false)

function openSelfieCamera() {
  isCameraOpen.value = true
}

function onSelfieCaptured(file: File) {
  if (selfiePreview.value)
    URL.revokeObjectURL(selfiePreview.value)
  selfieFile.value = file
  selfiePreview.value = URL.createObjectURL(file)
}

// Камера недоступна (нет разрешения/устройства) — системная камера как фолбэк.
// Селфи дэйлика намеренно НЕ ходит через галерею (антифрод): только живая
// камера, а фолбэк — системная камера с capture.
function onCameraFallback() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = 'user'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file)
      return
    if (selfiePreview.value)
      URL.revokeObjectURL(selfiePreview.value)
    selfieFile.value = file
    selfiePreview.value = URL.createObjectURL(file)
  }
  input.click()
}

// Фото машины: шторка «галерея или камера» → редактор (зум/поворот) → превью.
const isVehicleSourceOpen = ref(false)
const vehicleEditorFile = ref<File | null>(null)

function pickVehiclePhoto() {
  isVehicleSourceOpen.value = true
}

function onVehicleSourceSelected(file: File) {
  isVehicleSourceOpen.value = false
  vehicleEditorFile.value = file
}

function onVehicleEditorDone(file: File) {
  vehicleEditorFile.value = null
  if (vehiclePhotoPreview.value)
    URL.revokeObjectURL(vehiclePhotoPreview.value)
  vehiclePhotoFile.value = file
  vehiclePhotoPreview.value = URL.createObjectURL(file)
}

onUnmounted(() => {
  if (selfiePreview.value)
    URL.revokeObjectURL(selfiePreview.value)
  if (vehiclePhotoPreview.value)
    URL.revokeObjectURL(vehiclePhotoPreview.value)
})

async function submit() {
  if (!canSubmit.value || driver.isLoading)
    return

  try {
    await driver.doSubmitDailyCheck(vehicleId.value, selfieFile.value!, vehiclePhotoFile.value!)
    await router.replace('/menu/profile/onboarding')
  }
  catch {}
}
</script>

<template>
  <main class="tg-safe-bottom tg-safe-x h-full overflow-y-auto bg-secondary-900 text-white">
    <section class="mx-auto max-w-sm pb-6 pt-[calc(var(--app-safe-area-top)+6.5rem)]">
      <div class="flex items-center gap-3">
        <div class="h-13 w-13 flex shrink-0 items-center justify-center rounded-2xl bg-main-500/18 text-main-200">
          <span class="i-mdi-calendar-check text-7" />
        </div>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-2xl font-950">
            Ежедневная проверка
          </h1>
          <p class="mt-1 text-sm text-slate-400 leading-5">
            Каждый день перед выходом на линию отправляйте свежее селфи и фото машины.
          </p>
        </div>
      </div>

      <div v-if="!hasVehicle" class="mt-8 rounded-3xl bg-amber-500/12 p-5">
        <p class="text-sm text-amber-300 font-700">
          Сначала добавьте и верифицируйте автомобиль.
        </p>
        <RouterLink
          class="mt-3 block text-sm text-amber-300 font-900 underline"
          to="/menu/vehicle"
        >
          Добавить машину
        </RouterLink>
      </div>

      <!-- Уже отправлено сегодня — пройдено или на проверке: статус, а не форма -->
      <template v-else-if="dailyValid">
        <div
          class="mt-8 rounded-3xl p-5"
          :class="dailyPending ? 'bg-amber-500/10' : 'bg-emerald-500/10'"
        >
          <div class="flex items-center gap-4">
            <span
              class="h-14 w-14 flex shrink-0 items-center justify-center rounded-2xl"
              :class="dailyPending ? 'bg-amber-500/16 text-amber-300' : 'bg-emerald-500/16 text-emerald-300'"
            >
              <span :class="dailyPending ? 'i-mdi-shield-sync' : 'i-mdi-shield-check'" class="text-8" />
            </span>
            <div class="min-w-0">
              <h2 class="text-xl font-950" :class="dailyPending ? 'text-amber-100' : 'text-emerald-100'">
                {{ dailyPending ? 'Проверка на проверке' : 'Проверка пройдена' }}
              </h2>
              <p class="mt-0.5 text-sm leading-5" :class="dailyPending ? 'text-amber-300/85' : 'text-emerald-300/85'">
                {{ dailyPending
                  ? 'Мы проверяем ваше селфи и фото машины. Обычно это занимает недолго.'
                  : 'Ежедневный фотоконтроль пройден — можно на линию. Следующий перед завтрашней сменой.' }}
              </p>
            </div>
          </div>
        </div>

        <RouterLink
          to="/menu/profile/onboarding"
          class="mt-8 h-14 w-full flex items-center justify-center gap-2 rounded-2xl bg-white/8 text-base text-white font-800 transition active:scale-[0.98]"
        >
          <span class="i-mdi-format-list-checks text-5" />
          К списку проверок
        </RouterLink>
      </template>

      <div v-else class="mt-8 space-y-6">
        <!-- Причина отказа поддержки — что исправить перед повторной отправкой -->
        <div v-if="dailyRejectionReason" class="flex items-start gap-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-300 leading-5">
          <span class="i-mdi-alert-circle shrink-0 text-5 text-red-400" />
          <span>{{ dailyRejectionReason }}</span>
        </div>

        <!-- Памятка (как в Я.Про) -->
        <div class="rounded-2xl bg-white/5 p-4">
          <p class="mb-2 text-xs text-slate-300 font-800 uppercase">
            Чтобы сделать правильное фото
          </p>
          <ul class="text-xs text-slate-400 leading-5 space-y-1.5">
            <li class="flex items-start gap-2">
              <span class="i-mdi-white-balance-sunny mt-0.5 shrink-0 text-3.5 text-amber-300" />
              Найдите место с хорошим освещением
            </li>
            <li class="flex items-start gap-2">
              <span class="i-mdi-face-mask-outline mt-0.5 shrink-0 text-3.5 text-slate-300" />
              Снимите маску и тёмные очки
            </li>
            <li class="flex items-start gap-2">
              <span class="i-mdi-cellphone mt-0.5 shrink-0 text-3.5 text-main-300" />
              Держите телефон на уровне лица
            </li>
          </ul>
        </div>

        <!-- Селфи: живая камера с овалом и автоснимком -->
        <div>
          <p class="mb-3 text-sm text-slate-300 font-700">
            Ваше селфи
          </p>
          <button
            class="relative mx-auto block h-52 w-52 overflow-hidden border-2 rounded-full border-dashed transition active:scale-[0.98]"
            :class="selfiePreview ? 'border-transparent' : 'border-white/16 bg-white/4'"
            type="button"
            @click="openSelfieCamera"
          >
            <img
              v-if="selfiePreview"
              :src="selfiePreview"
              class="h-full w-full object-cover"
              alt="Селфи"
            >
            <div v-else class="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <span class="i-mdi-face-recognition text-12" />
              <span class="px-4 text-center text-xs font-700 leading-4">Поместите лицо в овал — снимок сделается сам</span>
            </div>
            <div
              v-if="selfiePreview"
              class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/50 py-2 text-xs text-white font-700 backdrop-blur-sm"
            >
              <span class="i-mdi-camera-retake text-3.5" />
              Переснять
            </div>
          </button>
        </div>

        <!-- Фото машины -->
        <div>
          <p class="mb-3 text-sm text-slate-300 font-700">
            Фото машины
          </p>
          <button
            class="relative h-44 w-full overflow-hidden border-2 rounded-3xl border-dashed transition active:scale-[0.98]"
            :class="vehiclePhotoPreview ? 'border-transparent' : 'border-white/16 bg-white/4'"
            type="button"
            @click="pickVehiclePhoto"
          >
            <img
              v-if="vehiclePhotoPreview"
              :src="vehiclePhotoPreview"
              class="h-full w-full object-cover"
              alt="Фото машины"
            >
            <div v-else class="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <span class="i-mdi-car text-10" />
              <span class="text-sm font-700">Задняя камера</span>
            </div>
            <div
              v-if="vehiclePhotoPreview"
              class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/50 py-2 text-sm text-white font-700 backdrop-blur-sm"
            >
              <span class="i-mdi-pencil text-4" />
              Изменить
            </div>
          </button>
        </div>

        <p class="text-center text-xs text-slate-500 leading-5">
          Проверка действует 24 часа.<br>
          Требуется каждый день перед выходом.
        </p>

        <AuthButton
          :disabled="driver.isLoading || !canSubmit"
          icon="i-mdi-send"
          :loading="driver.isLoading"
          loading-text="Отправляем..."
          text="Отправить проверку"
          @click="submit"
        />
      </div>
    </section>

    <!-- Живая камера: овал, детекция лица, автоснимок -->
    <FaceCaptureCamera
      :open="isCameraOpen"
      @capture="onSelfieCaptured"
      @close="isCameraOpen = false"
      @fallback="onCameraFallback"
    />

    <PhotoSourceSheet
      camera-facing="environment"
      :open="isVehicleSourceOpen"
      title="Фото машины"
      @close="isVehicleSourceOpen = false"
      @selected="onVehicleSourceSelected"
    />
    <PhotoEditorModal
      :aspect="4 / 3"
      :file="vehicleEditorFile"
      :output-size="1600"
      title="Подгоните фото машины"
      @cancel="vehicleEditorFile = null"
      @done="onVehicleEditorDone"
    />
  </main>
</template>
