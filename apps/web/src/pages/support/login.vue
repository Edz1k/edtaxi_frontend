<script setup lang="ts">
definePage({
  meta: {
    guestOnly: true,
    guestOnlyRole: ['tech_support', 'admin', 'superadmin'],
    guestRedirect: '/support',
  },
})

useHead({
  title: 'Вход техподдержки | EdTaxi',
})
</script>

<template>
  <AuthLoginForm
    description="Войдите по номеру из списка техподдержки, чтобы работать с обращениями."
    flow="tech_support"
    footer="Отдельный вход для операторов техподдержки."
    icon="i-mdi-headset"
    success-redirect="/support"
    title="Вход техподдержки"
  />
</template>
