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

const TRAILING_SLASH_RE = /\/$/

function normalizePath(path: string) {
  return path.replace(TRAILING_SLASH_RE, '') || '/'
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
    <div class="pointer-events-auto grid grid-cols-3 mx-auto max-w-sm border app-surface rounded-[2rem] p-1 shadow-[0_18px_52px_rgba(0,0,0,0.35)] backdrop-blur-2xl light:shadow-[0_12px_36px_rgba(16,20,26,0.12)]">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :aria-current="isActive(item.to) ? 'page' : undefined"
        :to="item.to"
        class="h-16 min-w-0 flex flex-col items-center justify-center rounded-[1.65rem] text-slate-300 transition active:scale-[0.97] light:text-slate-500 light:text-slate-600"
        :class="isActive(item.to)
          ? 'bg-white/13 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] light:bg-black/8 light:text-secondary-800 light:shadow-none'
          : 'hover:bg-white/6 light:hover:bg-black/4 light:hover:bg-black/4'"
      >
        <span :class="item.icon" class="text-7" />
        <span class="mt-1 truncate text-[12px] font-850 leading-none">
          {{ item.label }}
        </span>
      </RouterLink>
    </div>
  </nav>
</template>
