<script setup lang="ts">
import { useRoute as useVueRoute } from 'vue-router'
import AdminSidebar from '~/components/admin/AdminSidebar.vue'

const route = useVueRoute()
const isDrawerOpen = ref(false)

// Смена раздела закрывает мобильный slide-over.
watch(() => route.path, () => {
  isDrawerOpen.value = false
})
</script>

<template>
  <div class="min-h-screen overflow-hidden bg-#06142f text-white">
    <!-- Фон: мягкие блики + сетка (единый визуальный язык с кабинетом) -->
    <div class="pointer-events-none fixed inset-0">
      <div class="absolute left-[-14%] top-[-12%] h-80 w-80 rounded-full bg-cyan-300/14 blur-3xl" />
      <div class="absolute right-[-14%] top-40 h-96 w-96 rounded-full bg-blue-500/14 blur-3xl" />
      <div class="bg-size-[64px_64px] absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] opacity-10" />
    </div>

    <div class="relative mx-auto max-w-[1600px] flex gap-5 px-4 py-4 lg:px-6 lg:py-6">
      <!-- Десктоп: постоянный сайдбар -->
      <aside class="hidden w-72 shrink-0 lg:block">
        <div class="sticky top-6 h-[calc(100vh-3rem)]">
          <AdminSidebar />
        </div>
      </aside>

      <!-- Контент -->
      <main class="min-w-0 flex-1">
        <!-- Мобильная шапка с кнопкой меню -->
        <div class="mb-4 flex items-center gap-3 border border-white/10 rounded-2xl bg-white/6 px-3 py-2.5 backdrop-blur-xl lg:hidden">
          <button
            aria-label="Открыть меню разделов"
            class="h-10 w-10 flex shrink-0 items-center justify-center rounded-xl bg-white/8 text-white transition active:scale-95 hover:bg-white/14"
            type="button"
            @click="isDrawerOpen = true"
          >
            <span class="i-mdi-menu text-6" aria-hidden="true" />
          </button>
          <span class="text-base font-950">Админка</span>
        </div>

        <RouterView />
      </main>
    </div>

    <!-- Мобильный slide-over -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      leave-active-class="transition duration-150 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="isDrawerOpen" class="fixed inset-0 z-50 lg:hidden">
        <div class="absolute inset-0 bg-black/55 backdrop-blur-sm" @click="isDrawerOpen = false" />
        <Transition
          enter-active-class="transition-transform duration-200 ease-out"
          leave-active-class="transition-transform duration-150 ease-in"
          enter-from-class="-translate-x-full"
          leave-to-class="-translate-x-full"
          appear
        >
          <div v-if="isDrawerOpen" class="absolute inset-y-0 left-0 max-w-[86vw] w-72 p-3">
            <AdminSidebar @navigate="isDrawerOpen = false" />
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>
