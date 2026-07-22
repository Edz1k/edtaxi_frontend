<script setup lang="ts">
const router = useRouter()

useHead({
  title: 'Страница не найдена | Telegram Taxi',
})
</script>

<template>
  <main class="tg-safe-screen flex items-center justify-center app-screen text-white">
    <section class="mx-auto max-w-sm text-center">
      <p class="text-sm app-accent font-900 tracking-[0.35em] uppercase">
        404
      </p>
      <h1 class="mt-4 text-3xl font-950">
        Страница не найдена
      </h1>
      <p class="mt-3 text-sm app-muted font-700 leading-6">
        Такой экран не существует или ссылка устарела.
      </p>
      <button
        class="mt-6 h-12 rounded-2xl bg-main-500 px-5 text-sm font-950 transition active:scale-[0.98]"
        type="button"
        @click="router.push('/')"
      >
        На главный экран
      </button>
    </section>
  </main>
</template>
