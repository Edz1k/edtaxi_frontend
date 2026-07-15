<script setup lang="ts">
import PhotoEditorModal from '@edtaxi/shared/components/photo/PhotoEditorModal.vue'
import PhotoSourceSheet from '@edtaxi/shared/components/photo/PhotoSourceSheet.vue'
import { useAutoRefresh } from '@edtaxi/shared/composables/useAutoRefresh'
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
    screenTitle: 'Фото лица',
  },
})

useHead({
  title: 'Фото лица | Telegram Taxi Driver',
})

// Статус проверки лица определяет вид экрана: если уже одобрено/на проверке —
// показываем статус, а не форму повторной загрузки. Форма нужна только когда
// фото ещё не отправлено ('none') или отклонено ('rejected').
const faceStatus = computed(() => driver.verification?.face_status ?? 'none')
const showUploadForm = computed(() => faceStatus.value === 'none' || faceStatus.value === 'rejected')
const rejectionReason = computed(() => driver.verification?.face_rejection_reason ?? '')

// При прямом заходе на страницу (не из хаба) статус ещё не загружен — тянем сами.
onMounted(() => {
  if (!driver.verification)
    driver.loadVerification().catch(() => {})
})

// Пока фото на проверке — статус обновляется сам (поллинг + возврат на экран),
// водителю не нужно вручную перезаходить, чтобы увидеть одобрение.
useAutoRefresh(() => driver.loadVerification(), {
  enabled: computed(() => faceStatus.value === 'pending'),
  intervalMs: 12_000,
})

const selfieFile = ref<File | null>(null)
const selfiePreview = ref('')
const idFile = ref<File | null>(null)
const idPreview = ref('')

// Флоу выбора фото: шторка «галерея или камера» (раньше iPhone сразу открывал
// камеру, Android — галерею) → редактор (зум/поворот/центрирование) → превью.
type PickTarget = 'id' | 'selfie'
const pickTarget = ref<PickTarget>('selfie')
const isSourceOpen = ref(false)
const editorFile = ref<File | null>(null)

const editorProps = computed(() => pickTarget.value === 'selfie'
  ? { aspect: 1, cameraFacing: 'user' as const, round: true, title: 'Подгоните селфи' }
  : { aspect: 1.58, cameraFacing: 'environment' as const, round: false, title: 'Подгоните фото документа' })

function pickSelfie() {
  pickTarget.value = 'selfie'
  isSourceOpen.value = true
}

function pickId() {
  pickTarget.value = 'id'
  isSourceOpen.value = true
}

function onSourceSelected(file: File) {
  isSourceOpen.value = false
  editorFile.value = file
}

function onEditorDone(file: File) {
  editorFile.value = null
  const url = URL.createObjectURL(file)
  if (pickTarget.value === 'selfie') {
    if (selfiePreview.value)
      URL.revokeObjectURL(selfiePreview.value)
    selfieFile.value = file
    selfiePreview.value = url
  }
  else {
    if (idPreview.value)
      URL.revokeObjectURL(idPreview.value)
    idFile.value = file
    idPreview.value = url
  }
}

onUnmounted(() => {
  if (selfiePreview.value)
    URL.revokeObjectURL(selfiePreview.value)
  if (idPreview.value)
    URL.revokeObjectURL(idPreview.value)
})

async function submit() {
  if (!selfieFile.value || !idFile.value || driver.isLoading)
    return

  try {
    await driver.doUploadFaceVerification(selfieFile.value, idFile.value)
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
          <span class="i-mdi-face-recognition text-7" />
        </div>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-2xl font-950">
            Фото лица
          </h1>
          <p class="mt-1 text-sm text-slate-400 leading-5">
            Селфи и документ проверит поддержка — это делается один раз.
          </p>
        </div>
      </div>

      <!-- Статус ещё грузится (прямой заход на страницу, не из хаба) -->
      <div v-if="driver.isLoadingVerification && !driver.verification" class="mt-8 flex items-center gap-3 text-sm text-slate-400">
        <span class="i-mdi-loading animate-spin text-5" />
        Загружаем статус...
      </div>

      <!-- Уже отправлено — одобрено или на проверке: показываем статус, а не форму -->
      <template v-else-if="!showUploadForm">
        <div
          class="mt-8 rounded-3xl p-5"
          :class="faceStatus === 'approved' ? 'bg-emerald-500/10' : 'bg-amber-500/10'"
        >
          <div class="flex items-center gap-4">
            <span
              class="h-14 w-14 flex shrink-0 items-center justify-center rounded-2xl"
              :class="faceStatus === 'approved' ? 'bg-emerald-500/16 text-emerald-300' : 'bg-amber-500/16 text-amber-300'"
            >
              <span :class="faceStatus === 'approved' ? 'i-mdi-shield-check' : 'i-mdi-shield-sync'" class="text-8" />
            </span>
            <div class="min-w-0">
              <h2 class="text-xl font-950" :class="faceStatus === 'approved' ? 'text-emerald-100' : 'text-amber-100'">
                {{ faceStatus === 'approved' ? 'Идентификация пройдена' : 'Фото на проверке' }}
              </h2>
              <p class="mt-0.5 text-sm leading-5" :class="faceStatus === 'approved' ? 'text-emerald-300/85' : 'text-amber-300/85'">
                {{ faceStatus === 'approved'
                  ? 'Селфи и документ подтверждены — повторная загрузка не нужна.'
                  : 'Мы проверяем ваши селфи и документ. Обычно это занимает недолго — сообщим о результате.' }}
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

      <!-- Форма загрузки — фото ещё не отправлено ('none') или отклонено ('rejected') -->
      <template v-else>
        <!-- Причина отказа поддержки — что исправить перед повторной отправкой -->
        <div v-if="rejectionReason" class="mt-8 flex items-start gap-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-300 leading-5">
          <span class="i-mdi-alert-circle shrink-0 text-5 text-red-400" />
          <span>{{ rejectionReason }}</span>
        </div>

        <!-- Селфи -->
        <div class="mt-8">
          <p class="mb-3 text-sm text-white font-800">
            1. Селфи
          </p>
          <button
            class="relative mx-auto block h-56 w-56 overflow-hidden border-2 rounded-full border-dashed transition active:scale-[0.98]"
            :class="selfiePreview ? 'border-transparent' : 'border-white/16 bg-white/4'"
            type="button"
            @click="pickSelfie"
          >
            <img v-if="selfiePreview" :src="selfiePreview" class="h-full w-full object-cover" alt="Селфи">
            <div v-else class="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
              <span class="i-mdi-camera text-14" />
              <span class="px-6 text-center text-sm font-700">Нажмите для фото</span>
            </div>
            <div
              v-if="selfiePreview"
              class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/50 py-2 text-sm text-white font-700 backdrop-blur-sm"
            >
              <span class="i-mdi-pencil text-4" />
              Изменить
            </div>
          </button>
          <p class="mt-3 text-center text-xs text-slate-500 leading-5">
            Лицо хорошо освещено и чётко видно, без очков и головных уборов.
          </p>
        </div>

        <!-- Документ -->
        <div class="mt-8">
          <p class="mb-3 text-sm text-white font-800">
            2. Удостоверение или паспорт
          </p>
          <button
            class="relative block h-44 w-full overflow-hidden border-2 rounded-3xl border-dashed transition active:scale-[0.98]"
            :class="idPreview ? 'border-transparent' : 'border-white/16 bg-white/4'"
            type="button"
            @click="pickId"
          >
            <img v-if="idPreview" :src="idPreview" class="h-full w-full object-cover" alt="Документ">
            <div v-else class="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
              <span class="i-mdi-card-account-details-outline text-12" />
              <span class="px-6 text-center text-sm font-700">Фото документа</span>
            </div>
            <div
              v-if="idPreview"
              class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/50 py-2 text-sm text-white font-700 backdrop-blur-sm"
            >
              <span class="i-mdi-pencil text-4" />
              Изменить
            </div>
          </button>
          <p class="mt-3 text-center text-xs text-slate-500 leading-5">
            Данные в документе должны читаться, без бликов.
          </p>
        </div>

        <AuthButton
          class="mt-8"
          :disabled="driver.isLoading || !selfieFile || !idFile"
          icon="i-mdi-upload"
          :loading="driver.isLoading"
          loading-text="Отправляем..."
          text="Отправить на проверку"
          @click="submit"
        />
      </template>

      <PhotoSourceSheet
        :camera-facing="editorProps.cameraFacing"
        :open="isSourceOpen"
        :title="pickTarget === 'selfie' ? 'Селфи' : 'Фото документа'"
        @close="isSourceOpen = false"
        @selected="onSourceSelected"
      />
      <PhotoEditorModal
        :aspect="editorProps.aspect"
        :file="editorFile"
        :output-size="1440"
        :round="editorProps.round"
        :title="editorProps.title"
        @cancel="editorFile = null"
        @done="onEditorDone"
      />
    </section>
  </main>
</template>
