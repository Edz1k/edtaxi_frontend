<script setup lang="ts">
import { readSavedAccounts } from '@edtaxi/shared/composables/auth/saved-accounts'
import { SAVED_ACCOUNTS_KEY, useAuthStore } from '~/stores/auth'

const router = useRouter()
const auth = useAuthStore()

useHead({
  title: 'Telegram Taxi Driver',
})

onMounted(async () => {
  auth.loadSession()
  await auth.restoreSession({ preferredRole: 'driver' }).catch(() => {})

  if (auth.role === 'driver') {
    // Гард сам уведёт на /login/phone, если номер ещё не подтверждён.
    await router.replace('/map')
    return
  }

  // Сессии нет (тихий вход не сработал или пользователь выходил сам):
  // страница выбора аккаунтов, если уже входили; ОТП-форма — только если
  // выбирать не из чего.
  await router.replace(readSavedAccounts(SAVED_ACCOUNTS_KEY).length ? '/login/accounts' : '/login')
})
</script>

<template>
  <main class="tg-safe-screen flex items-center justify-center app-screen text-white">
    <div class="h-10 w-10 animate-spin border-3 border-main-400 border-t-transparent rounded-full" />
  </main>
</template>
