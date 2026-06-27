<script setup lang="ts">
import type { VehicleCategory } from '~/types/trips'
import AuthButton from '~/components/auth/AuthButton.vue'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'

const router = useRouter()
const driver = useDriverOnboardingStore()

const categories: Array<{ label: string, value: VehicleCategory }> = [
  { label: 'Эконом', value: 'economy' },
  { label: 'Комфорт', value: 'comfort' },
  { label: 'Бизнес', value: 'business' },
  { label: 'Минивэн', value: 'minivan' },
]

const form = reactive({
  category: 'economy' as VehicleCategory,
  color: '',
  make: '',
  model: '',
  plate_number: '',
  year: new Date().getFullYear(),
})

const existingId = ref('')
const isEditing = computed(() => Boolean(existingId.value))

const canSubmit = computed(() => {
  return form.plate_number.trim()
    && form.make.trim()
    && form.model.trim()
    && form.color.trim()
    && form.year >= 1990
    && form.year <= 2030
})

function prefillFromExisting() {
  const existing = driver.vehicles[0]
  if (!existing)
    return

  existingId.value = existing.id
  form.category = existing.category
  form.color = existing.color
  form.make = existing.make
  form.model = existing.model
  form.plate_number = existing.plate_number
  form.year = existing.year
}

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Автомобиль',
  },
})

useHead({
  title: 'Автомобиль | EdTaxi Driver',
})

onMounted(async () => {
  if (!driver.vehicles.length)
    await driver.loadVehicles().catch(() => {})
  prefillFromExisting()
})

async function submitVehicle() {
  if (!canSubmit.value || driver.isLoading)
    return

  const payload = {
    category: form.category,
    color: form.color.trim(),
    make: form.make.trim(),
    model: form.model.trim(),
    plate_number: form.plate_number.trim().toUpperCase(),
    year: form.year,
  }

  try {
    if (isEditing.value)
      await driver.updateVehicle(existingId.value, payload)
    else
      await driver.saveVehicle(payload)

    await router.replace('/map')
  }
  catch {}
}
</script>

<template>
  <main class="tg-safe-bottom tg-safe-x h-full overflow-y-auto bg-secondary-900 text-white">
    <section class="mx-auto max-w-sm pb-6 pt-[calc(var(--app-safe-area-top)+6.5rem)]">
      <div class="flex items-center gap-3">
        <div class="h-13 w-13 flex shrink-0 items-center justify-center rounded-2xl bg-main-500/18 text-main-200">
          <span class="i-mdi-car-info text-7" />
        </div>

        <div class="min-w-0 flex-1">
          <h1 class="truncate text-2xl font-950">
            Автомобиль
          </h1>
          <p class="mt-1 text-sm text-slate-400 leading-5">
            {{ isEditing ? 'Ваша машина уже добавлена. Можно отредактировать данные.' : 'Добавьте машину, чтобы выйти на линию и получать заказы.' }}
          </p>
        </div>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="submitVehicle">
        <div>
          <label class="mb-2 block text-sm text-slate-300 font-600">Тариф</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="category in categories"
              :key="category.value"
              class="h-12 border rounded-2xl text-sm font-800 transition active:scale-[0.98]"
              :class="form.category === category.value ? 'border-main-400 bg-main-500/18 text-main-200' : 'border-white/10 bg-white/5 text-slate-300'"
              type="button"
              @click="form.category = category.value"
            >
              {{ category.label }}
            </button>
          </div>
        </div>

        <label class="block">
          <span class="mb-2 block text-sm text-slate-300 font-600">Госномер</span>
          <input v-model="form.plate_number" class="h-13 w-full border border-white/10 rounded-2xl bg-white/5 px-4 text-white font-800 outline-none focus:border-main-400" placeholder="777 AAA 01">
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-2 block text-sm text-slate-300 font-600">Марка</span>
            <input v-model="form.make" class="h-13 w-full border border-white/10 rounded-2xl bg-white/5 px-4 text-white font-800 outline-none focus:border-main-400" placeholder="Toyota">
          </label>

          <label class="block">
            <span class="mb-2 block text-sm text-slate-300 font-600">Модель</span>
            <input v-model="form.model" class="h-13 w-full border border-white/10 rounded-2xl bg-white/5 px-4 text-white font-800 outline-none focus:border-main-400" placeholder="Camry">
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-2 block text-sm text-slate-300 font-600">Год</span>
            <input v-model.number="form.year" class="h-13 w-full border border-white/10 rounded-2xl bg-white/5 px-4 text-white font-800 outline-none focus:border-main-400" inputmode="numeric" type="number">
          </label>

          <label class="block">
            <span class="mb-2 block text-sm text-slate-300 font-600">Цвет</span>
            <input v-model="form.color" class="h-13 w-full border border-white/10 rounded-2xl bg-white/5 px-4 text-white font-800 outline-none focus:border-main-400" placeholder="Белый">
          </label>
        </div>

        <AuthButton
          :disabled="driver.isLoading || !canSubmit"
          icon="i-mdi-check"
          :loading="driver.isLoading"
          loading-text="Сохраняем..."
          :text="isEditing ? 'Сохранить' : 'Продолжить'"
        />
      </form>
    </section>
  </main>
</template>
