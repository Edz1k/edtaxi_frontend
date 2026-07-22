<script setup lang="ts">
defineProps<{
  url: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex flex-col bg-secondary-950">
      <header class="tg-safe-x flex items-center justify-between border-b app-border px-4 pb-3 pt-[calc(var(--app-safe-area-top)+0.75rem)]">
        <p class="text-sm text-white font-900">
          Оплата
        </p>
        <button
          aria-label="Закрыть оплату"
          class="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 text-white"
          type="button"
          @click="emit('close')"
        >
          <span class="i-mdi-close text-5" />
        </button>
      </header>
      <iframe :src="url" class="w-full flex-1 border-0 bg-white" title="Оплата картой" />
    </div>
  </Teleport>
</template>
