<script setup lang="ts">
import BottomNav from '~/components/app/BottomNav.vue'
import RouteHeader from '~/components/app/RouteHeader.vue'

const router = useRouter()
const route = useRoute()

const navItems = [
  {
    icon: 'i-mdi-view-grid-outline',
    label: 'Меню',
    to: '/driver/menu',
  },
  {
    icon: 'i-mdi-steering',
    label: 'Линия',
    to: '/driver',
  },
  {
    icon: 'i-mdi-cash-multiple',
    label: 'Доход',
    to: '/driver/earnings',
  },
]
const tabRoutes = new Set(['/driver', '/driver/menu', '/driver/earnings'])
const normalizedPath = computed(() => route.path.replace(/\/$/, '') || '/driver')
const isDriverTabRoute = computed(() => tabRoutes.has(normalizedPath.value))
const shouldShowBackHeader = computed(() => normalizedPath.value.startsWith('/driver/') && !isDriverTabRoute.value)
const backTitle = computed(() => typeof route.meta.screenTitle === 'string' ? route.meta.screenTitle : 'Водитель')
const backSubtitle = computed(() => typeof route.meta.screenSubtitle === 'string' ? route.meta.screenSubtitle : 'Назад в меню')

function goToDriverMenu() {
  router.push('/driver/menu')
}
</script>

<template>
  <div class="tg-viewport-screen relative overflow-hidden bg-secondary-900 text-white">
    <main class="relative z-0 h-full">
      <RouterView />
    </main>

    <RouteHeader
      v-if="shouldShowBackHeader"
      back-label="Назад в меню водителя"
      :subtitle="backSubtitle"
      :title="backTitle"
      @back="goToDriverMenu"
    />

    <BottomNav
      v-if="isDriverTabRoute"
      aria-label="Навигация водителя"
      data-selector="data-driver-tabbar"
      :items="navItems"
    />
  </div>
</template>
