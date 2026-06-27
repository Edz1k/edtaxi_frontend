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

onMounted(async () => {
  if (!driver.verification)
    await driver.loadVerification().catch(() => {})
})

function pickFile(type: 'selfie' | 'vehicle') {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  if (type === 'selfie')
    input.capture = 'user'
  else
    input.capture = 'environment'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file)
      return
    const url = URL.createObjectURL(file)
    if (type === 'selfie') {
      selfieFile.value = file
      selfiePreview.value = url
    }
    else {
      vehiclePhotoFile.value = file
      vehiclePhotoPreview.value = url
    }
  }
  input.click()
}

async function submit() {
  if (!canSubmit.value || driver.isLoading)
    return

  try {
    await driver.doSubmitDailyCheck(vehicleId.value, selfieFile.value!, vehiclePhotoFile.value!)
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

      <div v-else class="mt-8 space-y-6">
        <!-- Селфи -->
        <div>
          <p class="mb-3 text-sm text-slate-300 font-700">
            Ваше селфи
          </p>
          <button
            class="relative mx-auto block h-52 w-52 overflow-hidden border-2 rounded-full border-dashed transition active:scale-[0.98]"
            :class="selfiePreview ? 'border-transparent' : 'border-white/16 bg-white/4'"
            type="button"
            @click="pickFile('selfie')"
          >
            <img
              v-if="selfiePreview"
              :src="selfiePreview"
              class="h-full w-full object-cover"
              alt="Селфи"
            >
            <div v-else class="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <span class="i-mdi-account text-12" />
              <span class="text-xs font-700">Передняя камера</span>
            </div>
            <div
              v-if="selfiePreview"
              class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/50 py-2 text-xs text-white font-700 backdrop-blur-sm"
            >
              <span class="i-mdi-pencil text-3.5" />
              Изменить
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
            @click="pickFile('vehicle')"
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
  </main>
</template>
