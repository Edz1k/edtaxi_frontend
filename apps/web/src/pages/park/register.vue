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
  title: 'Регистрация таксопарка | Telegram Taxi',
})

function optionalField(value: string) {
  const trimmed = value.trim()
  return trimmed || undefined
}

async function handleSubmit() {
  // Комиссию при регистрации не задаём — парк выставит её позже отдельной
  // заявкой, которую подтверждает администратор.
  const payload: TaxiParkRegisterPayload = {
    name: form.value.name.trim(),
    description: optionalField(form.value.description),
    bin: optionalField(form.value.bin),
    phone: optionalField(form.value.phone),
  }

  await parkStore.register(payload)
  toast.success('Заявка отправлена', 'Таксопарк появится в кабинете после проверки.')
  form.value = { name: '', description: '', bin: '', phone: '' }
  await router.push('/park')
}
</script>

<template>
  <main class="min-h-screen overflow-hidden bg-#06142f px-5 py-6 text-white">
    <div class="pointer-events-none fixed inset-0">
      <div class="absolute left-[-20%] top-[-12%] h-82 w-82 rounded-full bg-cyan-300/18 blur-3xl" />
      <div class="absolute right-[-16%] top-32 h-96 w-96 rounded-full bg-blue-500/18 blur-3xl" />
    </div>

    <section class="relative mx-auto max-w-1180px py-6">
      <div class="inline-flex items-center gap-2 border border-cyan-300/30 rounded-full bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
        <span class="i-mdi-taxi" />
        Для владельцев таксопарков
      </div>

      <div class="grid mt-8 items-start gap-8 lg:grid-cols-[1.05fr_1fr]">
        <!-- Слева: поля регистрации -->
        <div class="border border-white/10 rounded-3xl bg-white/8 p-6 backdrop-blur md:p-7">
          <h1 class="text-2xl font-950 md:text-3xl">
            Регистрация таксопарка
          </h1>
          <p class="mt-2 text-sm text-white/55 leading-6">
            Заполните данные — заявку рассмотрит менеджер платформы. Комиссию парка
            задаёте позже в кабинете (её подтверждает администратор).
          </p>

          <form class="grid mt-6 gap-4" @submit.prevent="handleSubmit">
            <label class="grid gap-1.5" :for="fieldIds.name">
              <span class="text-xs text-white/42 font-900 uppercase">Название парка</span>
              <input
                :id="fieldIds.name"
                v-model="form.name"
                class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
                maxlength="100"
                placeholder="Например: Taxi Group Almaty"
                required
                type="text"
              >
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="grid gap-1.5" :for="fieldIds.bin">
                <span class="text-xs text-white/42 font-900 uppercase">БИН</span>
                <input
                  :id="fieldIds.bin"
                  v-model="form.bin"
                  class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
                  inputmode="numeric"
                  maxlength="12"
                  placeholder="123456789012"
                  type="text"
                >
              </label>
              <label class="grid gap-1.5" :for="fieldIds.phone">
                <span class="text-xs text-white/42 font-900 uppercase">Телефон</span>
                <input
                  :id="fieldIds.phone"
                  v-model="form.phone"
                  autocomplete="tel"
                  class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
                  placeholder="+7 700 000 00 00"
                  type="tel"
                >
              </label>
            </div>

            <label class="grid gap-1.5" :for="fieldIds.description">
              <span class="text-xs text-white/42 font-900 uppercase">Описание (необязательно)</span>
              <textarea
                :id="fieldIds.description"
                v-model="form.description"
                class="w-full border border-white/10 rounded-xl bg-white/8 px-4 py-3 text-sm outline-none focus:border-cyan-300/40"
                maxlength="500"
                placeholder="Кратко расскажите о вашем парке..."
                rows="3"
              />
            </label>

            <button
              class="mt-1 h-12 w-full rounded-2xl bg-cyan-300 text-sm text-#06142f font-950 transition hover:bg-cyan-200 disabled:opacity-60"
              :disabled="parkStore.isMutating || !form.name.trim()"
              type="submit"
            >
              {{ parkStore.isMutating ? 'Регистрируем...' : 'Зарегистрировать таксопарк' }}
            </button>

            <p class="text-center text-xs text-white/40">
              Обычно рассмотрение заявки занимает менее 24 часов.
            </p>
          </form>
        </div>

        <!-- Справа: что даёт платформа -->
        <div class="grid gap-3">
          <h2 class="text-lg font-950">
            Подключите свой <span class="text-cyan-300">таксопарк</span> к платформе
          </h2>
          <p class="text-sm text-white/55 leading-6">
            Новые водители, управление автопарком, аналитика и автоматизация — в одном кабинете.
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="item in benefits"
              :key="item.title"
              class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur"
            >
              <span class="h-10 w-10 flex items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-200">
                <span :class="item.icon" class="text-6" />
              </span>
              <p class="mt-3 text-sm font-950">
                {{ item.title }}
              </p>
              <p class="mt-1 text-xs text-white/55 leading-5">
                {{ item.description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
