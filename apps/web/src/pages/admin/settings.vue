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
</script>

<template>
  <WebPageShell
    back-label="Админка"
    back-to="/admin"
    description="Глобальные настройки платформы: комиссия с поездок, коэффициент цены и тарифы по категориям. Изменения применяются к новым заказам сразу."
    title="Настройки"
  >
    <PlatformCommissionForm />
    <DemandOverviewSection />
    <HourlyForecastSection />
    <TariffsSection />
  </WebPageShell>
</template>
