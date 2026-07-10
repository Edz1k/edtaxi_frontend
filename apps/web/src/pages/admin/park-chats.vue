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
    layout: 'admin',
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
    embedded
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
      <div class="grid-cols-[48px_minmax(140px,1fr)_minmax(180px,1.2fr)_100px_150px_110px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
        <span>№</span>
        <span>Парк</span>
        <span>Водитель</span>
        <span>Статус</span>
        <span>Обновлён</span>
        <span class="text-right">Профиль</span>
      </div>

      <div v-if="admin.isLoadingParkChats" class="px-4 py-6 text-sm text-white/50">
        Загружаем чаты...
      </div>

      <div v-else-if="!admin.parkChats.length" class="px-4 py-6 text-sm text-white/50">
        Чатов нет.
      </div>

      <!-- «№» — порядковый номер строки, а не идентификатор: UUID парка админу
           ни о чём не говорит, а короткого номера у парка в базе нет. -->
      <div
        v-for="(room, index) in admin.parkChats"
        v-else
        :key="room.id"
        class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[48px_minmax(140px,1fr)_minmax(180px,1.2fr)_100px_150px_110px] md:items-center last:border-b-0"
      >
        <span class="text-sm text-white/40 font-900">{{ index + 1 }}</span>

        <span class="truncate text-sm font-800">{{ room.park_name || '—' }}</span>

        <div class="min-w-0">
          <p class="truncate text-sm font-800">
            {{ room.driver_name || 'Без имени' }}
          </p>
          <p v-if="room.driver_phone" class="truncate text-xs text-white/42">
            {{ room.driver_phone }}
          </p>
        </div>

        <span
          class="w-fit rounded-full px-3 py-1.5 text-xs font-900 md:w-auto md:rounded-none md:px-0 md:py-0 md:text-sm"
          :class="room.status === 'open' ? 'bg-emerald-500/12 text-emerald-300 md:bg-transparent' : 'bg-white/8 text-white/45 md:bg-transparent'"
        >
          {{ room.status === 'open' ? 'Открыт' : 'Закрыт' }}
        </span>

        <span class="text-xs text-white/50">{{ formatDate(room.updated_at) }}</span>

        <RouterLink
          v-if="room.driver_user_id"
          class="h-9 inline-flex items-center justify-center rounded-xl bg-white/10 px-3 text-xs font-900 transition md:justify-self-end hover:bg-white/16"
          :to="`/drivers/${room.driver_user_id}`"
        >
          Открыть
        </RouterLink>
        <span v-else class="text-xs text-white/30 md:justify-self-end">—</span>
      </div>
    </div>
  </WebPageShell>
</template>
