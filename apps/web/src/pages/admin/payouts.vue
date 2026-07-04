<script setup lang="ts">
import type { PayoutRequest, PayoutStatus } from '~/types/payout'
import AppSelectDropdown from '~/components/app/AppSelectDropdown.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useListFilter } from '~/composables/useListFilter'
import { useAdminStore } from '~/stores/admin'
import { formatDate, formatRevenue } from '~/utils/format'

const admin = useAdminStore()
const { value: statusFilter, model: statusModel } = useListFilter<PayoutStatus>('pending')

const rejectingPayout = ref<PayoutRequest | null>(null)
const rejectReason = ref('')

const statusOptions: Array<{ label: string, value: PayoutStatus | '' }> = [
  { label: 'Все', value: '' },
  { label: 'В обработке', value: 'pending' },
  { label: 'Выплаченные', value: 'paid' },
  { label: 'Отклонённые', value: 'rejected' },
]

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({
  title: 'Выплаты | Админка',
})

onMounted(() => {
  loadPayouts()
})

watch(statusFilter, () => loadPayouts())

function loadPayouts() {
  admin.loadPayouts({ status: statusFilter.value || undefined, limit: 100 }).catch(() => {})
}

function openRejectModal(payout: PayoutRequest) {
  rejectingPayout.value = payout
  rejectReason.value = ''
}

function closeRejectModal() {
  rejectingPayout.value = null
  rejectReason.value = ''
}

async function confirmReject() {
  if (!rejectingPayout.value)
    return
  await admin.rejectPayout(rejectingPayout.value, rejectReason.value.trim()).catch(() => {})
  closeRejectModal()
}

function requesterLabel(payout: PayoutRequest) {
  return payout.requester_type === 'driver' ? 'Водитель' : 'Парк'
}

function requesterId(payout: PayoutRequest) {
  return payout.requester_type === 'driver' ? payout.driver_id : payout.park_id
}

function statusLabel(status: PayoutStatus) {
  const labels: Record<PayoutStatus, string> = {
    paid: 'Выплачена',
    pending: 'В обработке',
    rejected: 'Отклонена',
  }
  return labels[status]
}

function statusClass(status: PayoutStatus) {
  if (status === 'paid')
    return 'bg-emerald-500/12 text-emerald-300 md:bg-transparent'
  if (status === 'rejected')
    return 'bg-red-500/12 text-red-300 md:bg-transparent'
  return 'bg-amber-500/12 text-amber-300 md:bg-transparent'
}
</script>

<template>
  <WebPageShell
    back-label="Админка"
    back-to="/admin"
    description="Заявки водителей и парков на вывод средств. Перевод выполняется вручную вне системы, после чего заявку нужно отметить оплаченной."
    title="Выплаты"
  >
    <template #actions>
      <AppSelectDropdown v-model="statusModel" label="Статус" :options="statusOptions" />
      <button
        :disabled="admin.isLoadingPayouts"
        class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-60"
        type="button"
        @click="loadPayouts()"
      >
        <span class="i-mdi-refresh text-5 text-cyan-200" :class="{ 'animate-spin': admin.isLoadingPayouts }" />
        {{ admin.isLoadingPayouts ? 'Обновляем...' : 'Обновить' }}
      </button>
    </template>

    <!-- Rejection modal -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
        <div
          v-if="rejectingPayout"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          @click.self="rejectingPayout = null"
        >
          <form
            class="max-w-lg w-full border border-white/10 rounded-3xl bg-#071a38 p-6 shadow-2xl"
            @submit.prevent="confirmReject()"
          >
            <h2 class="text-xl font-950">
              Отклонить заявку на выплату
            </h2>
            <p class="mt-1 text-sm text-white/55">
              {{ requesterLabel(rejectingPayout) }} · {{ formatRevenue(rejectingPayout.amount) }}. Сумма вернётся на баланс заявителя.
            </p>

            <label class="grid mt-5 gap-1.5">
              <span class="text-xs text-white/42 font-900 uppercase">Причина отклонения</span>
              <textarea
                v-model="rejectReason"
                class="w-full border border-white/10 rounded-xl bg-white/8 px-4 py-3 text-sm outline-none focus:border-red-300/40"
                maxlength="500"
                placeholder="Укажите причину для заявителя..."
                rows="3"
              />
            </label>

            <div class="mt-5 flex gap-3">
              <button
                :disabled="admin.isMutating"
                class="h-11 flex-1 rounded-2xl bg-red-500 text-sm text-white font-900 transition hover:bg-red-400 disabled:opacity-60"
                type="submit"
              >
                {{ admin.isMutating ? 'Отклоняем...' : 'Отклонить' }}
              </button>
              <button
                class="h-11 border border-white/12 rounded-2xl bg-white/8 px-5 text-sm font-900 transition hover:bg-white/12"
                type="button"
                @click="closeRejectModal()"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>

    <div class="mt-5 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
      <div class="grid-cols-[130px_110px_minmax(160px,1fr)_130px_130px_220px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
        <span>Сумма</span>
        <span>Кто</span>
        <span>Реквизиты</span>
        <span>Статус</span>
        <span>Создана</span>
        <span class="text-right">Действие</span>
      </div>

      <div v-if="admin.isLoadingPayouts" class="px-4 py-6 text-sm text-white/50">
        Загружаем заявки...
      </div>

      <div v-else-if="!admin.payouts.length" class="px-4 py-6 text-sm text-white/50">
        Заявок на выплату нет.
      </div>

      <div
        v-for="payout in admin.payouts"
        v-else
        :key="payout.id"
        class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[130px_110px_minmax(160px,1fr)_130px_130px_220px] md:items-center last:border-b-0"
      >
        <span class="text-sm font-950">{{ formatRevenue(payout.amount) }}</span>

        <div class="min-w-0">
          <p class="text-sm font-900">
            {{ requesterLabel(payout) }}
          </p>
          <p class="mt-0.5 truncate text-xs text-white/42">
            {{ requesterId(payout) || '—' }}
          </p>
        </div>

        <div class="min-w-0">
          <p class="truncate text-sm text-white/62">
            {{ payout.destination || 'Реквизиты не указаны' }}
          </p>
          <p v-if="payout.status === 'rejected' && payout.rejection_reason" class="mt-0.5 truncate text-xs text-red-300/80 font-700">
            {{ payout.rejection_reason }}
          </p>
        </div>

        <span
          class="w-fit rounded-full px-3 py-1.5 text-xs font-900 md:w-auto md:rounded-none md:px-0 md:py-0 md:text-sm"
          :class="statusClass(payout.status)"
        >
          {{ statusLabel(payout.status) }}
        </span>

        <span class="text-sm text-white/50 font-800">{{ formatDate(payout.created_at) }}</span>

        <div class="flex flex-wrap items-center justify-start gap-2 md:justify-end">
          <template v-if="payout.status === 'pending'">
            <button
              :disabled="admin.isMutating"
              class="h-10 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 transition active:scale-[0.98] disabled:opacity-50"
              type="button"
              @click="admin.markPayoutPaid(payout)"
            >
              Отметить оплаченной
            </button>
            <button
              :disabled="admin.isMutating"
              class="h-10 rounded-xl bg-red-500/12 px-3 text-sm text-red-300 font-900 transition active:scale-[0.98] disabled:opacity-50"
              type="button"
              @click="openRejectModal(payout)"
            >
              Отклонить
            </button>
          </template>
          <span v-else-if="payout.reviewed_at" class="text-xs text-white/38">
            Обработана {{ formatDate(payout.reviewed_at) }}
          </span>
        </div>
      </div>
    </div>
  </WebPageShell>
</template>
