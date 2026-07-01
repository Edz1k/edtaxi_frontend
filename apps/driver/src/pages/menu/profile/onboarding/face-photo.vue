<script setup lang="ts">
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
  title: 'Фото лица | EdTaxi Driver',
})

const selfieFile = ref<File | null>(null)
const selfiePreview = ref('')
const idFile = ref<File | null>(null)
const idPreview = ref('')

// capture: 'user' открывает фронтальную камеру для селфи; для документа — обычный
// выбор файла/тыловая камера. В будущем селфи можно заменить на live-камеру.
function pickSelfie() {
  pickImage('user', (file, url) => {
    if (selfiePreview.value)
      URL.revokeObjectURL(selfiePreview.value)
    selfieFile.value = file
    selfiePreview.value = url
  })
}

function pickId() {
  pickImage('environment', (file, url) => {
    if (idPreview.value)
      URL.revokeObjectURL(idPreview.value)
    idFile.value = file
    idPreview.value = url
  })
}

onUnmounted(() => {
  if (selfiePreview.value)
    URL.revokeObjectURL(selfiePreview.value)
  if (idPreview.value)
    URL.revokeObjectURL(idPreview.value)
})

function pickImage(capture: string, onPick: (file: File, url: string) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = capture
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file)
      return
    onPick(file, URL.createObjectURL(file))
  }
  input.click()
}

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
    </section>
  </main>
</template>
