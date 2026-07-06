<script setup lang="ts">
withDefaults(defineProps<{
  backLabel?: string
  backTo?: string
  description?: string
  // Встроенный режим: страница внутри лейаута с сайдбаром — рисуем только шапку
  // и контент, без фулскрин-фона (его даёт лейаут).
  embedded?: boolean
  eyebrow?: string
  title: string
}>(), {
  backLabel: '',
  backTo: '',
  description: '',
  embedded: false,
  eyebrow: '',
})
</script>

<template>
  <component
    :is="embedded ? 'div' : 'main'"
    :class="embedded ? '' : 'min-h-screen overflow-hidden bg-#06142f px-5 py-6 text-white'"
  >
    <div v-if="!embedded" class="pointer-events-none fixed inset-0">
      <div class="absolute left-[-18%] top-[-12%] h-78 w-78 rounded-full bg-cyan-300/16 blur-3xl" />
      <div class="absolute right-[-18%] top-36 h-92 w-92 rounded-full bg-blue-500/16 blur-3xl" />
      <div class="bg-size-[64px_64px] absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] opacity-12" />
    </div>

    <section class="relative" :class="{ 'mx-auto max-w-1180px': !embedded }">
      <header class="flex flex-wrap items-center justify-between gap-4 border border-white/12 rounded-3xl bg-white/8 px-5 py-4 backdrop-blur-xl">
        <div>
          <RouterLink
            v-if="backTo"
            class="mb-2 h-9 inline-flex items-center gap-1.5 border border-white/10 rounded-full bg-white/8 pl-2 pr-3.5 text-sm text-cyan-200 font-900 transition hover:bg-white/14"
            :to="backTo"
          >
            <span class="i-mdi-arrow-left text-4.5" />
            {{ backLabel || eyebrow || 'Назад' }}
          </RouterLink>
          <p v-else-if="eyebrow" class="text-sm text-cyan-200 font-900">
            {{ eyebrow }}
          </p>

          <h1 class="mt-2 text-4xl font-950">
            {{ title }}
          </h1>

          <p v-if="description" class="mt-2 max-w-xl text-sm text-white/55 leading-6">
            {{ description }}
          </p>
        </div>

        <div v-if="$slots.actions" class="flex flex-wrap items-center justify-end gap-3">
          <slot name="actions" />
        </div>
      </header>

      <slot />
    </section>
  </component>
</template>
