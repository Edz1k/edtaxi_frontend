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
    screenSubtitle: 'Назад',
    screenTitle: 'Документы машины',
  },
})

useHead({
  title: 'Документы машины | EdTaxi Driver',
})

const vehiclePhotoFile = ref<File | null>(null)
const vehiclePhotoPreview = ref('')
const techPassportFile = ref<File | null>(null)
const techPassportPreview = ref('')

const vehicleId = computed(() => driver.verification?.vehicles[0]?.id ?? '')

const hasVehicle = computed(() => Boolean(vehicleId.value))

const canSubmit = computed(() =>
  hasVehicle.value && (vehiclePhotoFile.value !== null || techPassportFile.value !== null),
)

onMounted(async () => {
  if (!driver.verification)
    await driver.loadVerification().catch(() => {})
})

function pickFile(type: 'photo' | 'passport') {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file)
      return
    const url = URL.createObjectURL(file)
    if (type === 'photo') {
      vehiclePhotoFile.value = file
      vehiclePhotoPreview.value = url
    }
    else {
      techPassportFile.value = file
      techPassportPreview.value = url
    }
  }
  input.click()
}

async function submit() {
  if (!canSubmit.value || driver.isLoading)
    return

  try {
    if (vehiclePhotoFile.value)
      await driver.doUploadVehiclePhoto(vehicleId.value, vehiclePhotoFile.value)

    if (techPassportFile.value)
      await driver.doUploadTechPassport(vehicleId.value, techPassportFile.value)

    await router.replace('/menu/onboarding')
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
            Документы машины
          </h1>
          <p class="mt-1 text-sm text-slate-400 leading-5">
            Загрузите фото автомобиля и техпаспорт для проверки.
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

      <div v-else class="mt-8 space-y-6">
        <!-- Фото автомобиля -->
        <div>
          <p class="mb-3 text-sm text-slate-300 font-700">
            Фото автомобиля
          </p>
          <button
            class="relative h-44 w-full overflow-hidden border-2 rounded-3xl border-dashed transition active:scale-[0.98]"
            :class="vehiclePhotoPreview ? 'border-transparent' : 'border-white/16 bg-white/4'"
            type="button"
            @click="pickFile('photo')"
          >
            <img
              v-if="vehiclePhotoPreview"
              :src="vehiclePhotoPreview"
              class="h-full w-full object-cover"
              alt="Фото авто"
            >
            <div v-else class="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <span class="i-mdi-camera text-10" />
              <span class="text-sm font-700">Нажмите, чтобы выбрать фото</span>
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

        <!-- Техпаспорт -->
        <div>
          <p class="mb-3 text-sm text-slate-300 font-700">
            Техпаспорт
          </p>
          <button
            class="relative h-44 w-full overflow-hidden border-2 rounded-3xl border-dashed transition active:scale-[0.98]"
            :class="techPassportPreview ? 'border-transparent' : 'border-white/16 bg-white/4'"
            type="button"
            @click="pickFile('passport')"
          >
            <img
              v-if="techPassportPreview"
              :src="techPassportPreview"
              class="h-full w-full object-cover"
              alt="Техпаспорт"
            >
            <div v-else class="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <span class="i-mdi-file-document text-10" />
              <span class="text-sm font-700">Нажмите, чтобы выбрать фото</span>
            </div>
            <div
              v-if="techPassportPreview"
              class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/50 py-2 text-sm text-white font-700 backdrop-blur-sm"
            >
              <span class="i-mdi-pencil text-4" />
              Изменить
            </div>
          </button>
        </div>

        <AuthButton
          :disabled="driver.isLoading || !canSubmit"
          icon="i-mdi-upload"
          :loading="driver.isLoading"
          loading-text="Загружаем..."
          text="Отправить на проверку"
          @click="submit"
        />
      </div>
    </section>
  </main>
</template>
