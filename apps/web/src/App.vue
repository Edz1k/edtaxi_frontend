<script setup lang="ts">
useHead({
  title: 'EdTaxi Web',
  meta: [
    {
      name: 'description',
      content: 'EdTaxi web panel',
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
