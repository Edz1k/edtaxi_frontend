<script setup lang="ts">
const router = useRouter()

useHead({
  title: 'Page not found',
})
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-6 py-10">
    <section class="text-center">
      <p class="text-sm text-slate-500 tracking-[0.35em] uppercase">
        404
      </p>
      <h1 class="mt-4 text-3xl text-slate-900 font-semibold">
        Page not found
      </h1>
      <p class="mt-3 text-slate-600">
        The page you requested does not exist.
      </p>
      <button
        class="mt-6 rounded-full bg-slate-900 px-5 py-2 text-sm text-white"
        @click="router.push('/')"
      >
        Back home
      </button>
    </section>
  </main>
</template>
