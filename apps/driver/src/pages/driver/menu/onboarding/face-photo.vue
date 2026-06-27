<script setup lang="ts">
import AuthButton from '~/components/auth/AuthButton.vue'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'

const router = useRouter()
const driver = useDriverOnboardingStore()

definePage({
  meta: {
    authRedirect: '/driver/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    screenSubtitle: 'Назад',
    screenTitle: 'Фото лица',
  },
})

useHead({
  title: 'Фото лица | EdTaxi Driver',
})

const photoFile = ref<File | null>(null)
const photoPreview = ref('')

function pickPhoto() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = 'user'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file)
      return
    photoFile.value = file
    photoPreview.value = URL.createObjectURL(file)
  }
  input.click()
}

async function submit() {
  if (!photoFile.value || driver.isLoading)
    return

  try {
    await driver.doUploadFacePhoto(photoFile.value)
    await router.replace('/driver/menu/onboarding')
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
            Сделайте чёткое селфи на камеру для подтверждения личности.
          </p>
        </div>
      </div>

      <div class="mt-8 space-y-6">
        <button
          class="relative mx-auto block h-64 w-64 overflow-hidden border-2 rounded-full border-dashed transition active:scale-[0.98]"
          :class="photoPreview ? 'border-transparent' : 'border-white/16 bg-white/4'"
          type="button"
          @click="pickPhoto"
        >
          <img
            v-if="photoPreview"
            :src="photoPreview"
            class="h-full w-full object-cover"
            alt="Фото лица"
          >
          <div v-else class="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <span class="i-mdi-camera text-14" />
            <span class="px-6 text-center text-sm font-700">Нажмите для фото</span>
          </div>
          <div
            v-if="photoPreview"
            class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/50 py-2.5 text-sm text-white font-700 backdrop-blur-sm"
          >
            <span class="i-mdi-pencil text-4" />
            Изменить
          </div>
        </button>

        <p class="text-center text-xs text-slate-500 leading-5">
          Лицо должно быть хорошо освещено и чётко видно.<br>
          Без очков и головных уборов.
        </p>

        <AuthButton
          :disabled="driver.isLoading || !photoFile"
          icon="i-mdi-upload"
          :loading="driver.isLoading"
          loading-text="Загружаем..."
          text="Отправить фото"
          @click="submit"
        />
      </div>
    </section>
  </main>
</template>
