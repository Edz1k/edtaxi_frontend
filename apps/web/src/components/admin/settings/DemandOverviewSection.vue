<script setup lang="ts">
import type { CategoryDemand } from '~/types/admin'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '~/constants/admin'
import { useAdminStore } from '~/stores/admin'

const admin = useAdminStore()

function loadDemand() {
  admin.loadDemandOverview().catch(() => {})
}

const demandCards = computed<CategoryDemand[]>(() => {
  const byCategory = new Map((admin.demandOverview?.current ?? []).map(d => [d.category, d]))
  return CATEGORY_ORDER.map(category => byCategory.get(category) ?? {
    category,
    active_searching: 0,
    available_drivers: 0,
    ratio: 0,
    coefficient: 1,
    surge_max: 0,
  })
})

onMounted(loadDemand)
</script>

<template>
  <section class="mt-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-950">
          Текущий коэффициент спроса
        </h2>
        <p class="mt-1 max-w-xl text-sm text-white/55 leading-6">
          Отношение активных поисков к доступным водителям по платформе — та же формула, что использует расчёт цены поездки.
        </p>
      </div>
      <button
        :disabled="admin.isLoadingDemand"
        class="h-10 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-60"
        type="button"
        @click="loadDemand()"
      >
        <span class="i-mdi-refresh text-4.5 text-cyan-200" :class="{ 'animate-spin': admin.isLoadingDemand }" />
        {{ admin.isLoadingDemand ? 'Обновляем...' : 'Обновить' }}
      </button>
    </div>

    <div class="grid mt-4 gap-4 lg:grid-cols-4 sm:grid-cols-2">
      <div v-for="card in demandCards" :key="card.category" class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <p class="text-xs text-white/42 font-900 uppercase">
          {{ CATEGORY_LABELS[card.category] }}
        </p>
        <p class="mt-2 text-3xl font-950">
          ×{{ card.coefficient.toFixed(2) }}
        </p>
        <p class="mt-2 text-xs text-white/50 leading-5">
          {{ card.active_searching }} в поиске · {{ card.available_drivers }} свободных водителей
        </p>
        <p class="mt-1 text-xs text-white/35">
          Потолок категории: {{ card.surge_max > 0 ? `×${card.surge_max.toFixed(1)}` : 'нет (общий лимит ×3.0)' }}
        </p>
      </div>
    </div>
  </section>
</template>
