<script setup lang="ts">
useHead({
  title: 'Telegram Taxi — Поездка',
  meta: [
    { name: 'description', content: 'Информация о поездке Telegram Taxi' },
  ],
})
</script>

<template>
  <main font-sans>
    <RouterView />
    <AppToaster />
  </main>
</template>
