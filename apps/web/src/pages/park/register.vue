<script setup lang="ts">
import type { TaxiParkRegisterPayload } from '~/types/park'
import { useId } from 'vue'
import { useToast } from '~/composables/useToast'
import { useParkStore } from '~/stores/park'

const router = useRouter()
const toast = useToast()
const parkStore = useParkStore()

const fieldIds = {
  bin: useId(),
  commission: useId(),
  description: useId(),
  name: useId(),
  phone: useId(),
}

const form = ref({
  name: '',
  description: '',
  bin: '',
  phone: '',
})

const commissionPercent = ref(0)

const benefits = [
  {
    icon: 'i-mdi-account-group',
    title: 'Управление водителями',
    description: 'Добавляйте и контролируйте всех водителей в одном месте.',
  },
  {
    icon: 'i-mdi-chart-line',
    title: 'Рост прибыли',
    description: 'Следите за заказами, доходами и эффективностью парка.',
  },
  {
    icon: 'i-mdi-cellphone',
    title: 'Telegram Mini App',
    description: 'Водители работают через удобное приложение в Telegram.',
  },
  {
    icon: 'i-mdi-shield-check',
    title: 'Безопасность',
    description: 'Защищённая авторизация и управление доступом.',
  },
]

definePage({
  meta: {
    authRedirect: '/park/login',
    requiresAuth: true,
    requiredRole: ['park', 'admin', 'superadmin'],
  },
})

useHead({
  title: 'Регистрация таксопарка | EdTaxi',
})

function optionalField(value: string) {
  const trimmed = value.trim()
  return trimmed || undefined
}

function resetForm() {
  form.value = {
    name: '',
    description: '',
    bin: '',
    phone: '',
  }
  commissionPercent.value = 0
}

async function handleSubmit() {
  const payload: TaxiParkRegisterPayload = {
    name: form.value.name.trim(),
    description: optionalField(form.value.description),
    bin: optionalField(form.value.bin),
    phone: optionalField(form.value.phone),
    commission_rate: Number((commissionPercent.value / 100).toFixed(4)),
  }

  await parkStore.register(payload)
  toast.success('Заявка отправлена', 'Таксопарк появится в кабинете после проверки.')
  resetForm()
  await router.push('/park')
}
</script>

<template>
  <div class="min-h-screen bg-#0B1120 text-white">
    <div class="mx-auto max-w-7xl px-6 py-16">
      <div class="grid gap-12 lg:grid-cols-2">
        <!-- Левая часть -->
        <div class="flex flex-col justify-center">
          <div
            class="mb-4 inline-flex items-center gap-2 border border-cyan-500/20 rounded-full bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300"
          >
            <div class="i-mdi-taxi text-lg" />
            Для владельцев таксопарков
          </div>

          <h1 class="mb-6 text-5xl font-900 leading-tight">
            Подключите свой
            <span class="text-cyan-400">
              таксопарк
            </span>
            к платформе
          </h1>

          <p class="mb-8 max-w-xl text-lg text-white/70">
            Получайте новых водителей, управляйте автопарком,
            отслеживайте показатели и автоматизируйте работу через
            современную платформу.
          </p>

          <div class="grid gap-4 sm:grid-cols-2">
            <div
              v-for="item in benefits"
              :key="item.title"
              class="border border-white/10 rounded-3xl bg-white/5 p-5 backdrop-blur"
            >
              <div
                :class="item.icon"
                class="mb-3 text-3xl text-cyan-400"
              />

              <div class="mb-2 font-700">
                {{ item.title }}
              </div>

              <div class="text-sm text-white/60">
                {{ item.description }}
              </div>
            </div>
          </div>
        </div>

        <!-- Правая часть -->
        <div
          class="rounded-4xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl"
        >
          <div class="mb-8">
            <h2 class="text-3xl font-800">
              Регистрация таксопарка
            </h2>

            <p class="mt-2 text-white/60">
              Заполните данные и мы свяжемся с вами.
            </p>
          </div>

          <form
            class="space-y-5"
            @submit.prevent="handleSubmit"
          >
            <div>
              <label :for="fieldIds.name" class="mb-2 block text-sm text-white/60">
                Название парка
              </label>

              <input
                :id="fieldIds.name"
                v-model="form.name"
                type="text"
                name="park_name"
                placeholder="Например: Taxi Group Almaty"
                required
                class="w-full border border-white/10 rounded-2xl bg-white/5 px-4 py-3 outline-none transition focus:border-cyan-400"
              >
            </div>

            <div>
              <label :for="fieldIds.bin" class="mb-2 block text-sm text-white/60">
                БИН
              </label>

              <input
                :id="fieldIds.bin"
                v-model="form.bin"
                type="text"
                name="park_bin"
                placeholder="123456789012"
                class="w-full border border-white/10 rounded-2xl bg-white/5 px-4 py-3 outline-none transition focus:border-cyan-400"
              >
            </div>

            <div>
              <label :for="fieldIds.phone" class="mb-2 block text-sm text-white/60">
                Телефон
              </label>

              <input
                :id="fieldIds.phone"
                v-model="form.phone"
                type="tel"
                autocomplete="tel"
                name="park_phone"
                placeholder="+7 (700) 000 00 00"
                class="w-full border border-white/10 rounded-2xl bg-white/5 px-4 py-3 outline-none transition focus:border-cyan-400"
              >
            </div>

            <div>
              <label :for="fieldIds.commission" class="mb-2 block text-sm text-white/60">
                Комиссия парка (%)
              </label>

              <input
                :id="fieldIds.commission"
                v-model.number="commissionPercent"
                type="number"
                inputmode="decimal"
                max="3"
                min="0"
                name="park_commission_percent"
                placeholder="3"
                step="0.1"
                class="w-full border border-white/10 rounded-2xl bg-white/5 px-4 py-3 outline-none transition focus:border-cyan-400"
              >
            </div>

            <div>
              <label :for="fieldIds.description" class="mb-2 block text-sm text-white/60">
                Описание
              </label>

              <textarea
                :id="fieldIds.description"
                v-model="form.description"
                name="park_description"
                rows="4"
                placeholder="Кратко расскажите о вашем парке..."
                class="w-full border border-white/10 rounded-2xl bg-white/5 px-4 py-3 outline-none transition focus:border-cyan-400"
              />
            </div>

            <button
              type="submit"
              :disabled="parkStore.isMutating"
              class="w-full rounded-2xl bg-cyan-500 px-6 py-4 text-black font-700 transition disabled:cursor-not-allowed hover:bg-cyan-400 disabled:opacity-60"
            >
              <span v-if="parkStore.isMutating">
                Регистрация...
              </span>

              <span v-else>
                Зарегистрировать таксопарк
              </span>
            </button>

            <div class="text-center text-sm text-white/40">
              Обычно рассмотрение заявки занимает менее 24 часов
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
