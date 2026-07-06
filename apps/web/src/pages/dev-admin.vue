<script setup lang="ts">
// ВРЕМЕННАЯ dev-превью админ-лейаута (sidebar + контент) без auth. Удаляется.
import WebPageShell from '~/components/app/WebPageShell.vue'

definePage({
  meta: {
    layout: 'admin',
  },
})
</script>

<template>
  <WebPageShell
    embedded
    description="Роли, блокировка и список аккаунтов пользователей платформы."
    title="Пользователи"
  >
    <template #actions>
      <button class="h-10 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 text-sm text-#06142f font-900 transition hover:bg-cyan-200" type="button">
        <span class="i-mdi-filter-variant text-5" /> Фильтры
      </button>
    </template>

    <div class="grid mt-7 gap-4 md:grid-cols-3">
      <div v-for="i in 6" :key="i" class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <div class="h-10 w-10 rounded-2xl bg-cyan-300/12" />
        <div class="mt-4 h-4 w-24 rounded bg-white/15" />
        <div class="mt-3 h-3 w-full rounded bg-white/8" />
        <div class="mt-2 h-3 w-2/3 rounded bg-white/8" />
      </div>
    </div>
  </WebPageShell>
</template>
