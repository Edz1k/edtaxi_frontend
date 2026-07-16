<script setup lang="ts">
import { hideAppSplash } from '@edtaxi/shared/composables/useAppSplash'
import { useTelegramSafeArea } from '@edtaxi/shared/composables/useTelegramSafeArea'

useTelegramSafeArea()

const route = useRoute()

// Стартовый экран держат только те страницы, которым есть чего ждать
// (карта: отрисовка + геопозиция, meta.holdSplash) — они снимают его сами.
// На всех остальных стартовых экранах (логин, меню) ждать нечего.
onMounted(() => {
  if (!route.meta.holdSplash)
    hideAppSplash()
})

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
