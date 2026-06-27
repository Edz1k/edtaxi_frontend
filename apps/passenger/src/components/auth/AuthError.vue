<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<template>
  <p v-if="message" class="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
    {{ message }}
  </p>
</template>
