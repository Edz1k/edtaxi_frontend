<script setup lang="ts">
defineProps<{
  description: string
  icon: string
  title: string
}>()

defineSlots<{
  before?: Record<string, never>
  default?: Record<string, never>
  footer?: Record<string, never>
}>()
</script>

<template>
  <main class="min-h-screen bg-secondary-900 px-4 py-8 text-white">
    <div class="mx-auto max-w-sm min-h-[calc(100vh-64px)] flex flex-col justify-between">
      <section class="pt-8">
        <slot name="before" />

        <div class="mb-8 flex justify-center">
          <div class="h-20 w-20 flex items-center justify-center rounded-3xl bg-main-500 shadow-lg shadow-main-500/30">
            <div class="text-4xl text-white" :class="icon" />
          </div>
        </div>

        <div class="text-center">
          <h1 class="text-3xl font-800 tracking-tight">
            {{ title }}
          </h1>
          <p class="mt-3 text-sm text-slate-400 leading-6">
            {{ description }}
          </p>
        </div>

        <slot />
      </section>

      <footer class="pb-2 pt-3 text-center text-xs text-slate-500 leading-5">
        <slot name="footer" />
      </footer>
    </div>
  </main>
</template>
