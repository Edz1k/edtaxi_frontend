<script setup lang="ts">
import type { VehiclePhotoSlot } from '~/types/driver'
import PhotoEditorModal from '@edtaxi/shared/components/photo/PhotoEditorModal.vue'
import PhotoSourceSheet from '@edtaxi/shared/components/photo/PhotoSourceSheet.vue'
import { useAutoRefresh } from '@edtaxi/shared/composables/useAutoRefresh'
import { mediaUrl } from '~/api/client'
import AuthButton from '~/components/auth/AuthButton.vue'
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
    screenTitle: 'Фото машины',
  },
})

useHead({
  title: 'Фото машины | Telegram Taxi Driver',
})

interface SlotMeta {
  slot: VehiclePhotoSlot
  label: string
  icon: string
  capture: string | null
  optional?: boolean
}

interface SlotGroup {
  title: string
  // kind делит группы на «фото машины» и «документы»: пункты онбординга
  // «Фотоконтроль машины» / «Фотоконтроль документов» открывают только свою
  // часть (?section=car|docs), чтобы водитель не путал, что куда загружать.
  kind: 'car' | 'docs'
  slots: SlotMeta[]
}

const CAR_SLOT_GROUPS: SlotGroup[] = [
  {
    title: 'Кузов автомобиля',
    kind: 'car',
    slots: [
      { slot: 'exterior_front', label: 'Спереди', icon: 'i-mdi-car', capture: 'environment' },
      { slot: 'exterior_back', label: 'Сзади', icon: 'i-mdi-car-back', capture: 'environment' },
      { slot: 'exterior_left', label: 'Левый бок', icon: 'i-mdi-car-side', capture: 'environment' },
      { slot: 'exterior_right', label: 'Правый бок', icon: 'i-mdi-car-side', capture: 'environment' },
    ],
  },
  {
    title: 'Салон',
    kind: 'car',
    slots: [
      { slot: 'interior_front', label: 'Передние сиденья', icon: 'i-mdi-car-seat', capture: 'environment' },
      { slot: 'interior_back', label: 'Задний ряд сидений', icon: 'i-mdi-seat', capture: 'environment' },
      { slot: 'dashboard', label: 'Панель приборов (с одометром)', icon: 'i-mdi-speedometer', capture: 'environment' },
    ],
  },
  {
    title: 'Багажник',
    kind: 'car',
    slots: [
      { slot: 'trunk', label: 'Багажник', icon: 'i-mdi-bag-suitcase', capture: 'environment' },
    ],
  },
  {
    title: 'Документы',
    kind: 'docs',
    slots: [
      { slot: 'doc_registration_front', label: 'Техпаспорт (лицевая сторона)', icon: 'i-mdi-file-document', capture: null },
      { slot: 'doc_registration_back', label: 'Техпаспорт (обратная сторона)', icon: 'i-mdi-file-document-outline', capture: null },
      { slot: 'doc_insurance', label: 'Страховой полис', icon: 'i-mdi-shield-check', capture: null, optional: true },
    ],
  },
  {
    title: 'VIN',
    kind: 'docs',
    slots: [
      { slot: 'vin', label: 'VIN-номер', icon: 'i-mdi-barcode-scan', capture: 'environment', optional: true },
    ],
  },
]

// Для мототакси набор слотов другой: без салона и багажника, страховка
// обязательна, плюс фото второго шлема для пассажира.
const MOTO_SLOT_GROUPS: SlotGroup[] = [
  {
    title: 'Мотоцикл',
    kind: 'car',
    slots: [
      { slot: 'exterior_front', label: 'Спереди', icon: 'i-mdi-motorbike', capture: 'environment' },
      { slot: 'exterior_back', label: 'Сзади', icon: 'i-mdi-motorbike', capture: 'environment' },
      { slot: 'exterior_left', label: 'Левый бок', icon: 'i-mdi-motorbike', capture: 'environment' },
      { slot: 'exterior_right', label: 'Правый бок', icon: 'i-mdi-motorbike', capture: 'environment' },
    ],
  },
  {
    title: 'Экипировка',
    kind: 'car',
    slots: [
      { slot: 'moto_second_helmet', label: 'Второй шлем для пассажира', icon: 'i-mdi-racing-helmet', capture: 'environment' },
    ],
  },
  {
    title: 'Документы',
    kind: 'docs',
    slots: [
      { slot: 'doc_registration_front', label: 'Техпаспорт (лицевая сторона)', icon: 'i-mdi-file-document', capture: null },
      { slot: 'doc_registration_back', label: 'Техпаспорт (обратная сторона)', icon: 'i-mdi-file-document-outline', capture: null },
      { slot: 'doc_insurance', label: 'Страховой полис', icon: 'i-mdi-shield-check', capture: null },
    ],
  },
  {
    title: 'VIN',
    kind: 'docs',
    slots: [
      { slot: 'vin', label: 'VIN-номер', icon: 'i-mdi-barcode-scan', capture: 'environment', optional: true },
    ],
  },
]

const currentVehicle = computed(() => driver.verification?.vehicles[0] ?? driver.vehicles[0] ?? null)
const vehicleId = computed(() => currentVehicle.value?.id ?? '')
const hasVehicle = computed(() => Boolean(vehicleId.value))
const isMoto = computed(() => currentVehicle.value?.category === 'moto')

// Машина уже одобрена — показываем статус, а не сетку повторной загрузки.
// Только 'approved' (однозначно): pending у машины неотличим от «новая, ещё не
// отправлена» (VerificationStatus без 'none'), поэтому форму по нему не прячем.
const vehicleApproved = computed(() => currentVehicle.value?.verification_status === 'approved')
const vehicleRejectionReason = computed(() =>
  currentVehicle.value?.verification_status === 'rejected'
    ? currentVehicle.value?.rejection_reason ?? ''
    : '',
)

// ?section=car — только фото машины, ?section=docs — только документы,
// без параметра — всё вместе (старые точки входа).
const route = useRoute()
const section = computed<'all' | 'car' | 'docs'>(() => {
  const value = route.query.section
  return value === 'car' || value === 'docs' ? value : 'all'
})

const pageTitle = computed(() => {
  if (section.value === 'docs')
    return 'Документы машины'
  if (section.value === 'car')
    return isMoto.value ? 'Фото мотоцикла' : 'Фото машины'
  return isMoto.value ? 'Фото мотоцикла' : 'Фото машины'
})

const slotGroups = computed(() => {
  const groups = isMoto.value ? MOTO_SLOT_GROUPS : CAR_SLOT_GROUPS
  if (section.value === 'all')
    return groups
  return groups.filter(group => group.kind === section.value)
})

const uploadedRequiredCount = computed(() =>
  Math.max(0, driver.requiredPhotoSlots.length - driver.missingPhotoSlots.length),
)

function photoUrl(slot: VehiclePhotoSlot) {
  return driver.vehiclePhotos.find(p => p.slot === slot)?.photo_url ?? null
}

function isUploading(slot: VehiclePhotoSlot) {
  return driver.uploadingPhotoSlots.has(slot)
}

onMounted(async () => {
  if (!driver.verification)
    await driver.loadVerification().catch(() => {})

  if (vehicleId.value)
    await driver.loadVehiclePhotos(vehicleId.value).catch(() => {})
})

// Пока фото на проверке — вердикты поддержки подтягиваются сами (поллинг +
// возврат на экран), без ручного перезахода на страницу.
useAutoRefresh(async () => {
  await driver.loadVerification()
  if (vehicleId.value)
    await driver.loadVehiclePhotos(vehicleId.value)
}, {
  enabled: computed(() => hasVehicle.value && !vehicleApproved.value),
  intervalMs: 15_000,
})

// Флоу загрузки слота: шторка «галерея или камера» (раньше iPhone с capture
// сразу открывал камеру, без шанса выбрать готовое фото) → редактор
// (зум/поворот/центрирование) → аплоад в слот.
const pendingSlot = ref<null | SlotMeta>(null)
const isSourceOpen = ref(false)
const editorFile = ref<File | null>(null)

// Кадры: документы-карточки — вытянутые, полис — вертикальный лист, фото
// машины/салона — альбомные 4:3.
const editorAspect = computed(() => {
  const slot = pendingSlot.value?.slot ?? ''
  if (slot === 'doc_insurance')
    return 3 / 4
  if (slot.startsWith('doc_'))
    return 1.58
  return 4 / 3
})

function pickSlotFile(meta: SlotMeta) {
  if (!vehicleId.value || isUploading(meta.slot))
    return
  pendingSlot.value = meta
  isSourceOpen.value = true
}

function onSourceSelected(file: File) {
  isSourceOpen.value = false
  editorFile.value = file
}

async function onEditorDone(file: File) {
  const meta = pendingSlot.value
  editorFile.value = null
  if (!meta || !vehicleId.value)
    return
  await driver.doUploadVehicleSlotPhoto(vehicleId.value, meta.slot, file).catch(() => {})
}

async function submit() {
  if (!driver.canSubmitPhotos || driver.isSubmittingPhotos || !vehicleId.value)
    return

  try {
    await driver.doSubmitVehiclePhotos(vehicleId.value)
    useToast().success('Отправлено на проверку', 'Мы проверим фото и сообщим о результате.')
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
          <span class="i-mdi-car-key text-7" />
        </div>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-2xl font-950">
            {{ pageTitle }}
          </h1>
          <p class="mt-1 text-sm text-slate-400 leading-5">
            <template v-if="hasVehicle && driver.requiredPhotoSlots.length">
              Загружено {{ uploadedRequiredCount }} из {{ driver.requiredPhotoSlots.length }} обязательных
            </template>
            <template v-else-if="section === 'docs'">
              Загрузите документы машины для проверки.
            </template>
            <template v-else>
              Загрузите фото автомобиля и документы для проверки.
            </template>
          </p>
        </div>
      </div>

      <div v-if="!hasVehicle" class="mt-8 rounded-3xl bg-amber-500/12 p-5">
        <p class="text-sm text-amber-300 font-700">
          Сначала добавьте автомобиль в разделе «Автомобиль».
        </p>
        <RouterLink
          class="mt-3 block text-sm text-amber-300 font-900 underline"
          to="/menu/vehicle"
        >
          Добавить машину
        </RouterLink>
      </div>

      <!-- Уже проверено — показываем статус, а не сетку загрузки -->
      <template v-else-if="vehicleApproved">
        <div class="mt-8 rounded-3xl bg-emerald-500/10 p-5">
          <div class="flex items-center gap-4">
            <span class="h-14 w-14 flex shrink-0 items-center justify-center rounded-2xl bg-emerald-500/16 text-emerald-300">
              <span class="i-mdi-shield-check text-8" />
            </span>
            <div class="min-w-0">
              <h2 class="text-xl text-emerald-100 font-950">
                {{ isMoto ? 'Фото мотоцикла проверены' : 'Фото машины проверены' }}
              </h2>
              <p class="mt-0.5 text-sm text-emerald-300/85 leading-5">
                Фотоконтроль пройден — повторная загрузка не нужна.
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

      <div v-else class="mt-6 space-y-6">
        <!-- Причина отказа поддержки — что исправить перед повторной отправкой -->
        <div v-if="vehicleRejectionReason" class="flex items-start gap-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-300 leading-5">
          <span class="i-mdi-alert-circle shrink-0 text-5 text-red-400" />
          <span>{{ vehicleRejectionReason }}</span>
        </div>

        <!-- Подсказки по качеству фото -->
        <div class="rounded-2xl bg-white/5 p-4">
          <p class="mb-2 text-xs text-slate-300 font-800 uppercase">
            Как фотографировать
          </p>
          <ul class="text-xs text-slate-400 leading-5 space-y-1.5">
            <li class="flex items-start gap-2">
              <span class="i-mdi-check mt-0.5 shrink-0 text-3.5 text-emerald-400" />
              Хорошее освещение, без бликов
            </li>
            <li class="flex items-start gap-2">
              <span class="i-mdi-check mt-0.5 shrink-0 text-3.5 text-emerald-400" />
              {{ isMoto ? 'Мотоцикл в кадре целиком' : 'Автомобиль в кадре целиком' }}
            </li>
            <li class="flex items-start gap-2">
              <span class="i-mdi-check mt-0.5 shrink-0 text-3.5 text-emerald-400" />
              Номер и VIN хорошо читаются
            </li>
            <li class="flex items-start gap-2">
              <span class="i-mdi-check mt-0.5 shrink-0 text-3.5 text-emerald-400" />
              Без посторонних предметов в кадре
            </li>
          </ul>
        </div>

        <div v-if="driver.isLoadingPhotos" class="flex items-center gap-3 text-sm text-slate-400">
          <span class="i-mdi-loading animate-spin text-5" />
          Загружаем фото...
        </div>

        <template v-else>
          <div v-for="group in slotGroups" :key="group.title">
            <p class="mb-3 text-sm text-white font-800">
              {{ group.title }}
            </p>

            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="meta in group.slots"
                :key="meta.slot"
                class="relative h-32 overflow-hidden border-2 rounded-2xl border-dashed text-left transition active:scale-[0.98]"
                :class="photoUrl(meta.slot) ? 'border-transparent' : 'border-white/16 bg-white/4'"
                type="button"
                @click="pickSlotFile(meta)"
              >
                <img
                  v-if="photoUrl(meta.slot)"
                  :src="mediaUrl(photoUrl(meta.slot))"
                  class="h-full w-full object-cover"
                  :alt="meta.label"
                >
                <div v-else class="h-full flex flex-col items-center justify-center gap-1.5 px-2 text-center text-slate-400">
                  <span :class="meta.icon" class="text-8" />
                  <span class="text-xs font-700 leading-4">{{ meta.label }}</span>
                  <span v-if="meta.optional" class="text-[10px] text-slate-500">необязательно</span>
                </div>

                <!-- Спиннер загрузки -->
                <div v-if="isUploading(meta.slot)" class="absolute inset-0 flex items-center justify-center bg-black/60">
                  <span class="i-mdi-loading animate-spin text-8 text-white" />
                </div>

                <!-- Готово: галочка + подпись + кнопка "переснять" -->
                <template v-if="photoUrl(meta.slot) && !isUploading(meta.slot)">
                  <span class="absolute right-2 top-2 h-6 w-6 flex items-center justify-center rounded-full bg-emerald-500 text-white">
                    <span class="i-mdi-check text-4" />
                  </span>
                  <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-2.5 py-1.5 backdrop-blur-sm">
                    <span class="truncate text-[11px] text-white font-700">{{ meta.label }}</span>
                    <span class="flex items-center gap-1 text-[11px] text-main-200 font-800">
                      <span class="i-mdi-camera-retake text-3.5" />
                      Переснять
                    </span>
                  </div>
                </template>
              </button>
            </div>
          </div>
        </template>

        <AuthButton
          :disabled="driver.isSubmittingPhotos || !driver.canSubmitPhotos"
          icon="i-mdi-upload"
          :loading="driver.isSubmittingPhotos"
          loading-text="Отправляем..."
          text="Отправить на проверку"
          @click="submit"
        />
      </div>

      <PhotoSourceSheet
        camera-facing="environment"
        :open="isSourceOpen"
        :title="pendingSlot?.label ?? 'Добавить фото'"
        @close="isSourceOpen = false"
        @selected="onSourceSelected"
      />
      <PhotoEditorModal
        :aspect="editorAspect"
        :file="editorFile"
        :output-size="1600"
        :title="pendingSlot?.label ?? 'Подгоните фото'"
        @cancel="editorFile = null"
        @done="onEditorDone"
      />
    </section>
  </main>
</template>
