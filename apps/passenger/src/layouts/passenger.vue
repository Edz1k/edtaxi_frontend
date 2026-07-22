<script setup lang="ts">
import BottomNav from '~/components/app/BottomNav.vue'
import RouteHeader from '~/components/app/RouteHeader.vue'
import { useTripsStore } from '~/stores/trips'

const route = useRoute()
const router = useRouter()
const trips = useTripsStore()
const { t, te } = useI18n()

const navItems = computed(() => [
  {
    icon: 'i-mdi-view-grid-outline',
    label: t('nav.menu'),
    to: '/menu',
  },
  {
    icon: 'i-mdi-map-marker-path',
    label: t('nav.line'),
    to: '/map',
  },
  {
    icon: 'i-mdi-wallet-outline',
    label: t('nav.wallet'),
    to: '/wallet',
  },
])
const TRAILING_SLASH_RE = /\/$/
const tabRoutes = new Set(['/map', '/menu', '/wallet'])
const normalizedPath = computed(() => route.path.replace(TRAILING_SLASH_RE, '') || '/map')
const isPassengerTabRoute = computed(() => tabRoutes.has(normalizedPath.value))
const shouldShowBackHeader = computed(() => normalizedPath.value.startsWith('/menu/') && !isPassengerTabRoute.value)

// screenTitle в meta — либо ключ словаря (мигрированные экраны), либо сырой
// текст (ещё не мигрированные): te() различает, фолбэк показывает как есть.
function metaText(value: unknown, fallbackKey: string) {
  if (typeof value !== 'string' || !value)
    return t(fallbackKey)
  return te(value) ? t(value) : value
}
const backTitle = computed(() => metaText(route.meta.screenTitle, 'nav.passenger'))
const backSubtitle = computed(() => metaText(route.meta.screenSubtitle, 'nav.backToMenu'))

function goToPassengerMenu() {
  router.push('/menu')
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
      @back="goToPassengerMenu"
    />

    <!-- Пока печатают адрес — таб-бар убираем: клавиатура и так съела пол-экрана,
         а переключаться по вкладкам посреди ввода всё равно некуда. -->
    <BottomNav
      v-if="isPassengerTabRoute && !trips.isAddressSearchOpen"
      aria-label="Навигация пассажира"
      data-selector="data-passenger-tabbar"
      :items="navItems"
    />
  </div>
</template>
