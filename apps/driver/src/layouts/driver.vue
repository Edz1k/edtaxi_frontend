<script setup lang="ts">
import BottomNav from '~/components/app/BottomNav.vue'
import RouteHeader from '~/components/app/RouteHeader.vue'

const router = useRouter()
const route = useRoute()
const { t, te } = useI18n()

const navItems = computed(() => [
  {
    icon: 'i-mdi-view-grid-outline',
    label: t('nav.menu'),
    to: '/menu',
  },
  {
    icon: 'i-mdi-steering',
    label: t('nav.line'),
    to: '/map',
  },
  {
    icon: 'i-mdi-cash-multiple',
    label: t('nav.income'),
    to: '/earnings',
  },
])
const TRAILING_SLASH_RE = /\/$/
const tabRoutes = new Set(['/map', '/menu', '/earnings'])
const normalizedPath = computed(() => route.path.replace(TRAILING_SLASH_RE, '') || '/map')
const isDriverTabRoute = computed(() => tabRoutes.has(normalizedPath.value))
const shouldShowBackHeader = computed(() => normalizedPath.value.startsWith('/menu/') && !isDriverTabRoute.value)

// screenTitle в meta — либо ключ словаря (мигрированные экраны), либо сырой
// текст (ещё не мигрированные): te() различает, фолбэк показывает как есть.
function metaText(value: unknown, fallbackKey: string) {
  if (typeof value !== 'string' || !value)
    return t(fallbackKey)
  return te(value) ? t(value) : value
}
const backTitle = computed(() => metaText(route.meta.screenTitle, 'nav.driver'))
const backSubtitle = computed(() => metaText(route.meta.screenSubtitle, 'nav.backToMenu'))
const backTarget = computed(() => typeof route.meta.backTo === 'string' ? route.meta.backTo : '/menu')

function goBack() {
  router.push(backTarget.value)
}
</script>

<template>
  <div class="tg-viewport-screen relative overflow-hidden app-screen">
    <main class="relative z-0 h-full">
      <RouterView />
    </main>

    <RouteHeader
      v-if="shouldShowBackHeader"
      :back-label="t('nav.backToMenu')"
      :subtitle="backSubtitle"
      :title="backTitle"
      @back="goBack"
    />

    <BottomNav
      v-if="isDriverTabRoute"
      aria-label="Навигация водителя"
      data-selector="data-driver-tabbar"
      :items="navItems"
    />
  </div>
</template>
