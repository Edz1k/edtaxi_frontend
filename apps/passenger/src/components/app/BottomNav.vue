<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

interface BottomNavItem {
  icon: string
  label: string
  to: string
}

const props = withDefaults(defineProps<{
  ariaLabel?: string
  dataSelector?: string
  items: BottomNavItem[]
}>(), {
  ariaLabel: 'Основная навигация',
  dataSelector: '',
})

const route = useRoute()

const navAttrs = computed(() => props.dataSelector ? { [props.dataSelector]: '' } : {})

function normalizePath(path: string) {
  return path.replace(/\/$/, '') || '/'
}

function isActive(path: string) {
  return normalizePath(route.path) === normalizePath(path)
}
</script>

<template>
  <nav
    v-bind="navAttrs"
    :aria-label="ariaLabel"
    class="tg-safe-x pointer-events-none absolute inset-x-0 bottom-[calc(var(--app-safe-area-bottom)+0.75rem)] z-40"
  >
    <div class="pointer-events-auto grid grid-cols-3 mx-auto max-w-sm border border-white/10 rounded-[2rem] bg-secondary-950/78 p-1 shadow-[0_18px_52px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :aria-current="isActive(item.to) ? 'page' : undefined"
        :to="item.to"
        class="h-16 min-w-0 flex flex-col items-center justify-center rounded-[1.65rem] text-slate-300 transition active:scale-[0.97]"
        :class="isActive(item.to) ? 'bg-white/13 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'hover:bg-white/6'"
      >
        <span :class="item.icon" class="text-7" />
        <span class="mt-1 truncate text-[12px] font-850 leading-none">
          {{ item.label }}
        </span>
      </RouterLink>
    </div>
  </nav>
</template>
