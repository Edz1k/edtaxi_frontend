<script setup lang="ts">
import BottomNav from '~/components/app/BottomNav.vue'
import RouteHeader from '~/components/app/RouteHeader.vue'

const router = useRouter()
const route = useRoute()

const navItems = [
  {
    icon: 'i-mdi-view-grid-outline',
    label: 'Меню',
    to: '/menu',
  },
  {
    icon: 'i-mdi-steering',
    label: 'Линия',
    to: '/map',
  },
  {
    icon: 'i-mdi-cash-multiple',
    label: 'Доход',
    to: '/earnings',
  },
]
const tabRoutes = new Set(['/map', '/menu', '/earnings'])
const normalizedPath = computed(() => route.path.replace(/\/$/, '') || '/map')
const isDriverTabRoute = computed(() => tabRoutes.has(normalizedPath.value))
const shouldShowBackHeader = computed(() => normalizedPath.value.startsWith('/menu/') && !isDriverTabRoute.value)
const backTitle = computed(() => typeof route.meta.screenTitle === 'string' ? route.meta.screenTitle : 'Водитель')
const backSubtitle = computed(() => typeof route.meta.screenSubtitle === 'string' ? route.meta.screenSubtitle : 'Назад в меню')
const backTarget = computed(() => typeof route.meta.backTo === 'string' ? route.meta.backTo : '/menu')

function goBack() {
  router.push(backTarget.value)
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
