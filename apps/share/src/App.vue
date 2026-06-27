<script setup lang="ts">
useHead({
  title: 'EdTaxi — Поездка',
  meta: [
    { name: 'description', content: 'Информация о поездке EdTaxi' },
  ],
})
</script>

<template>
  <main font-sans>
    <RouterView />
    <AppToaster />
  </main>
</template>
