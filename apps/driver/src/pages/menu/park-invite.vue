<script setup lang="ts">
import { useToast } from '~/composables/useToast'
import { useDriverStore } from '~/stores/driver'

const driver = useDriverStore()

const toast = useToast()
const token = ref('')

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Таксопарк',
  },
})

useHead({
  title: 'Таксопарк | EdTaxi',
})

async function acceptInvite() {
  await driver.acceptParkInvite(token.value.trim())
  token.value = ''
  toast.success('Готово', 'Вы присоединились к таксопарку.')
}
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header>
        <p class="text-xs text-main-300 font-900 uppercase">
          Водитель
        </p>
        <h1 class="mt-1 text-3xl font-950">
          Таксопарк
        </h1>
        <p class="mt-2 text-sm text-slate-400 leading-5">
          Введите код приглашения, который выдал владелец парка.
        </p>
      </header>

      <form class="mt-6 rounded-3xl bg-white/5 p-4" @submit.prevent="acceptInvite">
        <label class="text-xs text-slate-400 font-800 uppercase" for="park-token">
          Код приглашения
        </label>
        <input
          id="park-token"
          v-model="token"
          class="mt-2 h-13 w-full border border-white/10 rounded-2xl bg-secondary-950/70 px-4 text-sm outline-none focus:border-main-400"
          placeholder="Введите token"
        >
        <button
          :disabled="driver.isLoadingParkInvite || !token.trim()"
          class="mt-3 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
          type="submit"
        >
          {{ driver.isLoadingParkInvite ? 'Проверяем...' : 'Присоединиться' }}
        </button>
      </form>
    </section>
  </main>
</template>
