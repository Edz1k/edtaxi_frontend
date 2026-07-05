<script setup lang="ts">
definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Настройки',
  },
})
</script>

<template>
  settings
</template>
