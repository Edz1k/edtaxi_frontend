<script setup lang="ts">
import { seedThemeFromTelegram } from '@edtaxi/shared/composables/telegram/theme'
import { useTelegramSafeArea } from '@edtaxi/shared/composables/useTelegramSafeArea'

useTelegramSafeArea()

// Первый запуск (нет сохранённого выбора темы) — берём тему из Telegram; после
// ручного выбора это не срабатывает, выбор пользователя всегда побеждает.
seedThemeFromTelegram()

useHead({
  title: 'EdTaxi',
  meta: [
    {
      name: 'description',
      content: 'Мини-приложение EdTaxi для пассажиров и водителей',
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
