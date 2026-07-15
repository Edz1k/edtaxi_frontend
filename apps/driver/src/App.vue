<script setup lang="ts">
import { useTelegramSafeArea } from '@edtaxi/shared/composables/useTelegramSafeArea'

useTelegramSafeArea()

useHead({
  title: 'Telegram Taxi',
  meta: [
    {
      name: 'description',
      content: 'Мини-приложение Telegram Taxi для пассажиров и водителей',
    },
  ],
  link: [
    {
      rel: 'icon',
      type: 'image/svg+xml',
      href: () => preferredDark.value ? '/favicon-dark.svg' : '/favicon.svg',
    },
  ],
})
</script>

<template>
  <main font-sans>
    <RouterView />
    <AppToaster />
  </main>
</template>
