<script setup lang="ts">
import { useToast } from '~/composables/useToast'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
  },
})

useHead({
  title: 'Аккаунт удалён | EdTaxi Driver',
})

onMounted(() => {
  auth.errorMessage = ''
  if (!auth.accountDeleted)
    router.replace('/map')
})

const isCreating = ref(false)

async function createAgain() {
  if (isCreating.value)
    return
  isCreating.value = true
  try {
    await auth.recreateAccount()
    await router.replace('/map')
  }
  catch (e: any) {
    toast.error('Не получилось', e?.message || 'Попробуйте позже или обратитесь в поддержку.')
  }
  finally {
    isCreating.value = false
  }
}

async function signOut() {
  await auth.logout().catch(() => {})
  await router.replace('/login')
}
</script>

<template>
  <main class="tg-safe-x h-full flex flex-col justify-center bg-secondary-900 px-6 text-white">
    <section class="mx-auto max-w-sm w-full">
      <span class="h-14 w-14 flex items-center justify-center rounded-2xl bg-red-500/14 text-red-300">
        <span class="i-mdi-account-off-outline text-8" />
      </span>
      <h1 class="mt-5 text-2xl font-950 leading-tight">
        Аккаунт удалён
      </h1>
      <p class="mt-3 text-sm text-slate-400 leading-6">
        Вы удалили аккаунт водителя. Можно создать его заново — рейтинг и история сохранятся.
      </p>

      <button
        :disabled="isCreating"
        class="mt-8 h-14 w-full flex items-center justify-center rounded-2xl bg-main-500 text-base text-secondary-900 font-950 transition active:scale-[0.98] disabled:opacity-60"
        type="button"
        @click="createAgain"
      >
        {{ isCreating ? 'Создаём...' : 'Создать аккаунт' }}
      </button>
      <button
        class="mt-3 h-12 w-full flex items-center justify-center rounded-2xl bg-white/8 text-sm text-slate-300 font-900 transition active:scale-[0.98]"
        type="button"
        @click="signOut"
      >
        Выйти
      </button>
    </section>
  </main>
</template>
