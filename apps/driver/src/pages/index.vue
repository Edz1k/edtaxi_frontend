<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const auth = useAuthStore()

useHead({
  title: 'EdTaxi Driver',
})

onMounted(async () => {
  auth.loadSession()
  await auth.restoreSession({ preferredRole: 'driver' }).catch(() => {})
  await router.replace(auth.role === 'driver' ? '/map' : '/login')
})
</script>

<template>
  <main class="tg-safe-screen flex items-center justify-center bg-secondary-900 text-white">
    <div class="h-10 w-10 animate-spin border-3 border-main-400 border-t-transparent rounded-full" />
  </main>
</template>
