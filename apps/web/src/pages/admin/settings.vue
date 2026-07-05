<script setup lang="ts">
import DemandOverviewSection from '~/components/admin/settings/DemandOverviewSection.vue'
import HourlyForecastSection from '~/components/admin/settings/HourlyForecastSection.vue'
import PlatformCommissionForm from '~/components/admin/settings/PlatformCommissionForm.vue'
import TariffsSection from '~/components/admin/settings/TariffsSection.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({
  title: 'Настройки | Админка',
})

type SettingsTab = 'commission' | 'demand' | 'tariffs'

const TABS: { id: SettingsTab, label: string, icon: string }[] = [
  { id: 'commission', label: 'Комиссия и цена', icon: 'i-mdi-percent-outline' },
  { id: 'tariffs', label: 'Тарифы', icon: 'i-mdi-taxi' },
  { id: 'demand', label: 'Спрос', icon: 'i-mdi-chart-timeline-variant' },
]

const route = useRoute()
const router = useRouter()

function isSettingsTab(value: unknown): value is SettingsTab {
  return TABS.some(tab => tab.id === value)
}

// Активная вкладка живёт и в ?tab=, чтобы ссылку на конкретный раздел можно
// было открыть/передать; replace — переключение вкладок не засоряет историю.
const activeTab = ref<SettingsTab>(isSettingsTab(route.query.tab) ? route.query.tab : 'commission')

function selectTab(tab: SettingsTab) {
  activeTab.value = tab
  router.replace({ query: { ...route.query, tab: tab === 'commission' ? undefined : tab } }).catch(() => {})
}
</script>

<template>
  <WebPageShell
    back-label="Админка"
    back-to="/admin"
    description="Глобальные настройки платформы: комиссия с поездок, коэффициент цены, тарифы по категориям и аналитика спроса. Изменения применяются к новым заказам сразу."
    title="Настройки"
  >
    <nav class="mt-6 flex flex-wrap gap-2">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="h-10 inline-flex items-center gap-2 border rounded-full px-4 text-sm font-900 transition"
        :class="activeTab === tab.id
          ? 'border-cyan-300/50 bg-cyan-300/16 text-cyan-100'
          : 'border-white/10 bg-white/8 text-white/55 hover:bg-white/12'"
        type="button"
        @click="selectTab(tab.id)"
      >
        <span class="text-4.5" :class="tab.icon" />
        {{ tab.label }}
      </button>
    </nav>

    <!-- v-show вместо v-if: сохраняет введённые в формы значения и не
         перезагружает данные при переключении вкладок туда-обратно. -->
    <div v-show="activeTab === 'commission'">
      <PlatformCommissionForm />
    </div>
    <div v-show="activeTab === 'tariffs'">
      <TariffsSection />
    </div>
    <div v-show="activeTab === 'demand'">
      <DemandOverviewSection />
      <HourlyForecastSection />
    </div>
  </WebPageShell>
</template>
