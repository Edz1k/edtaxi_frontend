<script setup lang="ts">
import type { AuthRole } from '~/types/auth'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const router = useRouter()

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
  },
})

useHead({
  title: 'Кабинет | EdTaxi',
})

onMounted(() => {
  auth.restoreSession().catch(() => router.push('/login'))
})

const roleLabels: Record<AuthRole, string> = {
  admin: 'Админ',
  driver: 'Водитель',
  park: 'Таксопарк',
  passenger: 'Пассажир',
  superadmin: 'Суперадмин',
  tech_support: 'Техподдержка',
}

const userName = computed(() => {
  const fullName = [auth.currentUser?.first_name, auth.currentUser?.last_name].filter(Boolean).join(' ')

  return fullName || auth.currentUser?.phone || 'Аккаунт EdTaxi'
})

const accessCards = computed(() => {
  const cards: Array<{
    description: string
    icon: string
    roles: AuthRole[]
    title: string
    to: string
  }> = [
    {
      description: 'Проверка заявок, пользователи, поездки и служебные разделы.',
      icon: 'i-mdi-view-dashboard-outline',
      roles: ['admin', 'superadmin'],
      title: 'Админ-панель',
      to: '/admin',
    },
    {
      description: 'Очередь обращений, назначение диалогов и ответы клиентам.',
      icon: 'i-mdi-headset',
      roles: ['admin', 'superadmin', 'tech_support'],
      title: 'Техподдержка',
      to: '/support',
    },
    {
      description: 'Проверка фото машин при онбординге и ежедневных проверок водителей.',
      icon: 'i-mdi-shield-car',
      roles: ['admin', 'superadmin', 'tech_support'],
      title: 'Верификация водителей',
      to: '/support/verifications',
    },
    {
      description: 'Профиль парка, приглашения водителей, аналитика и чат с водителями.',
      icon: 'i-mdi-office-building-marker',
      roles: ['admin', 'superadmin', 'park'],
      title: 'Кабинет таксопарка',
      to: '/park',
    },
  ]

  return cards.filter(card => auth.hasAnyRole(card.roles))
})

async function logout() {
  // Оператора поддержки возвращаем на его вход (там список сохранённых
  // аккаунтов); админы и парки — на общий вход.
  const supportOnly = auth.hasRole('tech_support') && !auth.hasAnyRole(['admin', 'superadmin'])
  await auth.logout()
  await router.push(supportOnly ? '/support/login' : '/')
}
</script>

<template>
  <main class="min-h-screen overflow-hidden bg-#06142f px-5 py-6 text-white">
    <div class="pointer-events-none fixed inset-0">
      <div class="absolute left-[-20%] top-[-12%] h-82 w-82 rounded-full bg-cyan-300/18 blur-3xl" />
      <div class="absolute right-[-16%] top-32 h-96 w-96 rounded-full bg-blue-500/18 blur-3xl" />
      <div class="bg-size-[64px_64px] absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] opacity-12" />
    </div>

    <section class="relative mx-auto max-w-1180px">
      <header class="flex flex-wrap items-center justify-between gap-4 border border-white/12 rounded-3xl bg-white/8 px-4 py-4 shadow-xl backdrop-blur-xl">
        <RouterLink class="flex items-center gap-3" to="/">
          <span class="h-11 w-11 flex items-center justify-center rounded-full bg-cyan-300 text-#06142f">
            <span class="i-mdi-taxi text-6" />
          </span>
          <span>
            <span class="block text-sm font-950">EdTaxi</span>
            <span class="block text-xs text-white/50">Web cabinet</span>
          </span>
        </RouterLink>

        <button
          class="h-11 rounded-full bg-white/8 px-5 text-sm text-white/75 font-900 transition hover:bg-white/12"
          type="button"
          @click="logout"
        >
          Выйти
        </button>
      </header>

      <div class="grid min-h-[calc(100vh-8rem)] items-center gap-8 py-12 lg:grid-cols-[1fr_1.15fr]">
        <section>
          <div class="inline-flex items-center gap-2 border border-cyan-300/30 rounded-full bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
            <span class="i-mdi-shield-account" />
            Доступ по ролям
          </div>

          <h1 class="mt-6 max-w-650px text-4xl font-950 leading-none md:text-6xl">
            {{ userName }}
          </h1>

          <p class="mt-5 max-w-560px text-white/62 leading-7">
            После входа показываем только те разделы, которые разрешены вашим ролям. Если у аккаунта несколько ролей, все кабинеты доступны с этой страницы.
          </p>

          <div class="mt-6 flex flex-wrap gap-2">
            <span
              v-for="roleItem in auth.roles"
              :key="roleItem"
              class="border border-white/12 rounded-full bg-white/8 px-3 py-1.5 text-xs text-white/75 font-900"
            >
              {{ roleLabels[roleItem] }}
            </span>
          </div>
        </section>

        <section class="relative">
          <div class="absolute inset-0 rounded-42px bg-cyan-300/16 blur-3xl" />

          <div class="relative border border-cyan-200/20 rounded-36px bg-white/10 p-3 shadow-2xl backdrop-blur-xl md:p-5">
            <div class="border border-white/10 rounded-30px bg-#0a2148 p-5 md:p-7">
              <div class="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p class="text-sm text-cyan-200/70 font-800">
                    Разделы
                  </p>
                  <h2 class="mt-1 text-2xl font-950">
                    Что можно открыть
                  </h2>
                </div>
                <span class="h-12 w-12 flex items-center justify-center rounded-2xl bg-cyan-300 text-#06142f">
                  <span class="i-mdi-view-grid-outline text-7" />
                </span>
              </div>

              <div v-if="accessCards.length" class="grid gap-3">
                <RouterLink
                  v-for="card in accessCards"
                  :key="card.to"
                  class="group grid grid-cols-[3rem_1fr_auto] items-center gap-3 border border-white/10 rounded-3xl bg-white/8 p-4 transition hover:border-cyan-300/35 hover:bg-white/12"
                  :to="card.to"
                >
                  <span class="h-12 w-12 flex items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-200">
                    <span :class="card.icon" class="text-7" />
                  </span>
                  <span class="min-w-0">
                    <span class="block text-base font-950">{{ card.title }}</span>
                    <span class="mt-1 block text-sm text-white/55 leading-5">{{ card.description }}</span>
                  </span>
                  <span class="i-mdi-arrow-right text-6 text-white/35 transition group-hover:text-cyan-200" />
                </RouterLink>
              </div>

              <div v-else class="border border-amber-300/18 rounded-3xl bg-amber-300/8 p-5">
                <p class="text-base text-amber-100 font-950">
                  Нет доступных web-разделов
                </p>
                <p class="mt-2 text-sm text-white/58 leading-6">
                  Аккаунт авторизован, но для панели нужна роль таксопарка, техподдержки, админа или суперадмина.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
