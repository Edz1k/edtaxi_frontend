<script setup lang="ts">
definePage({
  meta: {
    guestOnly: true,
  },
})

useHead({
  title: 'Вход | Telegram Taxi',
})
</script>

<template>
  <AuthLoginForm
    description="Войдите по номеру телефона, чтобы открыть доступные административные разделы панели."
    flow="admin"
    footer="Вход для администраторов и суперадминистраторов."
    icon="i-mdi-shield-account"
    success-redirect="/dashboard"
    title="Вход в Telegram Taxi"
  />
</template>
