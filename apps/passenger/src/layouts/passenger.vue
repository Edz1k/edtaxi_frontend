<script setup lang="ts">
import BottomNav from '~/components/app/BottomNav.vue'
import RouteHeader from '~/components/app/RouteHeader.vue'

const route = useRoute()
const router = useRouter()

const navItems = [
  {
    icon: 'i-mdi-view-grid-outline',
    label: 'Меню',
    to: '/menu',
  },
  {
    icon: 'i-mdi-map-marker-path',
    label: 'Линия',
    to: '/map',
  },
  {
    icon: 'i-mdi-wallet-outline',
    label: 'Кошелек',
    to: '/wallet',
  },
]
const TRAILING_SLASH_RE = /\/$/
const tabRoutes = new Set(['/map', '/menu', '/wallet'])
const normalizedPath = computed(() => route.path.replace(TRAILING_SLASH_RE, '') || '/map')
const isPassengerTabRoute = computed(() => tabRoutes.has(normalizedPath.value))
const shouldShowBackHeader = computed(() => normalizedPath.value.startsWith('/menu/') && !isPassengerTabRoute.value)
const backTitle = computed(() => typeof route.meta.screenTitle === 'string' ? route.meta.screenTitle : 'Пассажир')
const backSubtitle = computed(() => typeof route.meta.screenSubtitle === 'string' ? route.meta.screenSubtitle : 'Назад в меню')

function goToPassengerMenu() {
  router.push('/menu')
}
</script>

<template>
  <div class="tg-viewport-screen relative overflow-hidden bg-secondary-900 text-white">
    <main class="relative z-0 h-full">
      <RouterView />
    </main>

    <RouteHeader
      v-if="shouldShowBackHeader"
      back-label="Назад в меню пассажира"
      :subtitle="backSubtitle"
      :title="backTitle"
      @back="goToPassengerMenu"
    />

    <BottomNav
      v-if="isPassengerTabRoute"
      aria-label="Навигация пассажира"
      data-selector="data-passenger-tabbar"
      :items="navItems"
    />
  </div>
</template>
