<script setup lang="ts">
import AppSelectDropdown from '~/components/app/AppSelectDropdown.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useListFilter } from '~/composables/useListFilter'
import { useAdminStore } from '~/stores/admin'
import { formatDate } from '~/utils/format'

const admin = useAdminStore()
const { value: statusFilter, model: statusModel } = useListFilter<'open' | 'closed'>()

const statuses: Array<{ label: string, value: 'closed' | 'open' | '' }> = [
  { label: 'Все', value: '' },
  { label: 'Открытые', value: 'open' },
  { label: 'Закрытые', value: 'closed' },
]

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({
  title: 'Чаты парков | Админка',
})

onMounted(() => {
  loadChats()
})

watch(statusFilter, () => loadChats())

function loadChats() {
  admin.loadParkChats({ status: statusFilter.value || undefined }).catch(() => {})
}
</script>

<template>
  <WebPageShell
    back-label="Админка"
    back-to="/admin"
    description="Служебный список диалогов между таксопарками и водителями."
    title="Чаты парков"
  >
    <template #actions>
      <AppSelectDropdown v-model="statusModel" label="Статус" :options="statuses" />
      <button
        :disabled="admin.isLoadingParkChats"
        class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-60"
        type="button"
        @click="loadChats()"
      >
        <span class="i-mdi-refresh text-5 text-cyan-200" :class="{ 'animate-spin': admin.isLoadingParkChats }" />
        {{ admin.isLoadingParkChats ? 'Загружаем...' : 'Обновить' }}
      </button>
    </template>

    <div class="mt-5 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
      <div class="grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_100px_160px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
        <span>ID парка</span>
        <span>ID водителя</span>
        <span>Статус</span>
        <span>Обновлён</span>
      </div>

      <div v-if="admin.isLoadingParkChats" class="px-4 py-6 text-sm text-white/50">
        Загружаем чаты...
      </div>

      <div v-else-if="!admin.parkChats.length" class="px-4 py-6 text-sm text-white/50">
        Чатов нет.
      </div>

      <div
        v-for="room in admin.parkChats"
        v-else
        :key="room.id"
        class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_100px_160px] md:items-center last:border-b-0"
      >
        <span class="truncate text-xs text-white/62 font-mono">{{ room.park_id }}</span>
        <span class="truncate text-xs text-white/62 font-mono">{{ room.driver_id }}</span>
        <span
          class="w-fit rounded-full px-3 py-1.5 text-xs font-900 md:w-auto md:rounded-none md:px-0 md:py-0 md:text-sm"
          :class="room.status === 'open' ? 'bg-emerald-500/12 text-emerald-300 md:bg-transparent' : 'bg-white/8 text-white/45 md:bg-transparent'"
        >
          {{ room.status === 'open' ? 'Открыт' : 'Закрыт' }}
        </span>
        <span class="text-xs text-white/50">{{ formatDate(room.updated_at) }}</span>
      </div>
    </div>
  </WebPageShell>
</template>
