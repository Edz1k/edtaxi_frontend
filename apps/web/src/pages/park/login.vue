<script setup lang="ts">
definePage({
  meta: {
    guestOnly: true,
    guestOnlyRole: ['park', 'admin', 'superadmin'],
    guestRedirect: '/park',
  },
})

useHead({
  title: 'Вход таксопарка | Telegram Taxi',
})
</script>

<template>
  <AuthLoginForm
    description="Войдите по номеру владельца таксопарка, чтобы открыть кабинет парка."
    flow="park"
    footer="Отдельный вход для владельцев таксопарков."
    icon="i-mdi-office-building-marker"
    success-redirect="/park"
    title="Вход таксопарка"
  />
</template>
