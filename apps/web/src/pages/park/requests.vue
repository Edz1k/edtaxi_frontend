<script setup lang="ts">
import type { ParkJoinRequest } from '~/types/promotions'
import { useAutoRefresh } from '@edtaxi/shared/composables/useAutoRefresh'
import { showErrorToast } from '~/api/errors'
import { approveParkJoinRequest, listParkJoinRequests, rejectParkJoinRequest } from '~/api/promotions'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { formatDate } from '~/utils/format'

definePage({
  meta: {
    authRedirect: '/park/login',
    requiresAuth: true,
    layout: 'park',
    requiredRole: ['park', 'admin', 'superadmin'],
  },
})

useHead({
  title: 'Заявки водителей | Telegram Taxi',
})

const requests = ref<ParkJoinRequest[]>([])
const isLoading = ref(false)
// id заявки, по которой идёт запрос — блокируем только её кнопки.
const mutatingId = ref('')

onMounted(load)

// Новые заявки появляются сами (возврат на вкладку + фоновый поллинг) — без
// спиннера, чтобы список не мигал; кнопка «Обновить» остаётся для ручного
// обновления с индикатором.
useAutoRefresh(async () => {
  const response = await listParkJoinRequests()
  requests.value = response.requests.filter(request => request.status === 'pending')
}, { intervalMs: 20_000 })

async function load() {
  isLoading.value = true
  try {
    const response = await listParkJoinRequests()
    requests.value = response.requests.filter(request => request.status === 'pending')
  }
  catch (error) {
    showErrorToast(error, 'Не удалось загрузить заявки водителей.')
  }
  finally {
    isLoading.value = false
  }
}

async function resolve(request: ParkJoinRequest, approved: boolean) {
  mutatingId.value = request.id
  try {
    await (approved ? approveParkJoinRequest(request.id) : rejectParkJoinRequest(request.id))
    requests.value = requests.value.filter(item => item.id !== request.id)
  }
  catch (error) {
    showErrorToast(error, approved ? 'Не удалось принять заявку.' : 'Не удалось отклонить заявку.')
  }
  finally {
    mutatingId.value = ''
  }
}
</script>

<template>
  <WebPageShell
    embedded
    description="Водители, которые хотят вступить в ваш парк. Принятый водитель сразу появится в списке водителей."
    title="Заявки водителей"
  >
    <template #actions>
      <button
        :disabled="isLoading"
        class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-60"
        type="button"
        @click="load()"
      >
        <span class="i-mdi-refresh text-5 text-cyan-200" :class="{ 'animate-spin': isLoading }" />
        {{ isLoading ? 'Обновляем...' : 'Обновить' }}
      </button>
    </template>

    <div class="mt-5 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
      <div class="grid-cols-[minmax(180px,1fr)_110px_110px_150px_220px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
        <span>Водитель</span>
        <span>Рейтинг</span>
        <span>Поездки</span>
        <span>Подана</span>
        <span class="text-right">Действие</span>
      </div>

      <div v-if="isLoading && !requests.length" class="px-4 py-6 text-sm text-white/50">
        Загружаем заявки...
      </div>

      <div v-else-if="!requests.length" class="px-4 py-10 text-center text-sm text-white/45">
        Новых заявок нет.
      </div>

      <div
        v-for="request in requests"
        v-else
        :key="request.id"
        class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_110px_110px_150px_220px] md:items-center last:border-b-0"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-900">
            {{ request.driver_name || 'Без имени' }}
          </p>
          <p class="mt-0.5 truncate text-xs text-white/42">
            {{ request.driver_phone || request.driver_id }}
          </p>
        </div>

        <span class="text-sm text-white/62 font-800">
          {{ request.driver_rating != null ? request.driver_rating.toFixed(1) : '—' }}
        </span>

        <span class="text-sm text-white/62 font-800">
          {{ request.driver_total_trips ?? 0 }}
        </span>

        <span class="text-sm text-white/50 font-800">
          {{ formatDate(request.created_at) }}
        </span>

        <div class="flex flex-wrap items-center justify-start gap-2 md:justify-end">
          <button
            :disabled="mutatingId === request.id"
            class="h-10 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
            type="button"
            @click="resolve(request, true)"
          >
            Принять
          </button>
          <button
            :disabled="mutatingId === request.id"
            class="h-10 rounded-xl bg-red-500/12 px-3 text-sm text-red-300 font-900 transition active:scale-[0.98] disabled:opacity-50"
            type="button"
            @click="resolve(request, false)"
          >
            Отклонить
          </button>
        </div>
      </div>
    </div>
  </WebPageShell>
</template>
