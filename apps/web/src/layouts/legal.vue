<script setup lang="ts">
// Юридические документы публикуются только на русском (решение по проекту),
// поэтому обвязка лейаута тоже без i18n.
const legalLinks = [
  { to: '/legal/offer', label: 'Договор публичной оферты' },
  { to: '/legal/privacy', label: 'Политика конфиденциальности' },
  { to: '/legal/refund', label: 'Порядок возврата средств' },
  { to: '/legal/requisites', label: 'Реквизиты' },
]
</script>

<template>
  <div class="min-h-screen bg-#06142f text-white">
    <header class="px-5 py-4">
      <div class="mx-auto max-w-900px flex items-center justify-between gap-4">
        <RouterLink to="/" class="min-w-0 flex items-center gap-3">
          <div class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-cyan-300 text-#06142f">
            <div class="i-mdi:taxi text-xl" />
          </div>

          <div class="min-w-0">
            <p class="truncate text-sm font-900 leading-4 md:text-base">
              Telegram Taxi
            </p>
            <p class="truncate text-xs text-white/50">
              City Flow Mobility Ltd.
            </p>
          </div>
        </RouterLink>

        <RouterLink
          to="/"
          class="inline-flex shrink-0 items-center gap-2 border border-white/15 rounded-full bg-white/8 px-4 py-2 text-sm text-white/80 transition hover:bg-white/12 hover:text-white"
        >
          <div class="i-mdi-arrow-left" />
          На главную
        </RouterLink>
      </div>
    </header>

    <div class="px-5 pb-12 pt-2">
      <article class="mx-auto max-w-900px rounded-3xl bg-white px-5 py-8 text-gray-800 shadow-2xl md:px-10 md:py-12">
        <RouterView />
      </article>

      <nav class="mx-auto mt-6 max-w-900px flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <RouterLink
          v-for="link in legalLinks"
          :key="link.to"
          :to="link.to"
          class="text-white/60 transition hover:text-cyan-300"
          active-class="text-cyan-300"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <p class="mx-auto mt-4 max-w-900px text-xs text-white/40">
        © {{ new Date().getFullYear() }} City Flow Mobility Ltd. Все права защищены.
      </p>
    </div>
  </div>
</template>
