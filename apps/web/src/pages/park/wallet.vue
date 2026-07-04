<script setup lang="ts">
import type { PayoutStatus } from '~/types/payout'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useParkStore } from '~/stores/park'
import { formatDate, formatRevenue } from '~/utils/format'

const parkStore = useParkStore()

const amount = ref<null | number>(null)
const destination = ref('')

definePage({
  meta: {
    authRedirect: '/park/login',
    requiresAuth: true,
    requiredRole: ['park', 'admin', 'superadmin'],
  },
})

useHead({
  title: 'Кошелёк парка | EdTaxi',
})

onMounted(() => {
  parkStore.loadWallet().catch(() => {})
})

const minPayout = computed(() => parkStore.wallet?.min_payout_amount ?? 0)

const canSubmit = computed(() => {
  if (!parkStore.wallet || parkStore.isMutating)
    return false
  return (amount.value ?? 0) >= minPayout.value
})

async function submitPayout() {
  if (!canSubmit.value || !amount.value)
    return

  await parkStore.requestPayout({
    amount: amount.value,
    destination: destination.value.trim() || undefined,
  })
  amount.value = null
  destination.value = ''
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
    return 'bg-emerald-500/12 text-emerald-300'
  if (status === 'rejected')
    return 'bg-red-500/12 text-red-300'
  return 'bg-amber-500/12 text-amber-300'
}
</script>

<template>
  <WebPageShell
    back-label="Таксопарк"
    back-to="/park"
    description="Баланс парка, заявки на вывод средств и их статусы. Выплаты выполняются вручную после проверки заявки."
    title="Кошелёк парка"
  >
    <template #actions>
      <button
        :disabled="parkStore.isLoadingWallet"
        class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-60"
        type="button"
        @click="parkStore.loadWallet()"
      >
        <span class="i-mdi-refresh text-5 text-cyan-200" :class="{ 'animate-spin': parkStore.isLoadingWallet }" />
        {{ parkStore.isLoadingWallet ? 'Обновляем...' : 'Обновить' }}
      </button>
    </template>

    <section v-if="parkStore.isLoadingWallet && !parkStore.wallet" class="mt-5 border border-white/10 rounded-3xl bg-white/8 p-5 text-sm text-white/50 backdrop-blur">
      Загружаем кошелёк...
    </section>

    <div v-else class="grid mt-6 gap-5">
      <section class="grid gap-4 md:grid-cols-2">
        <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
          <p class="text-xs text-white/42 font-900 uppercase">
            Доступно к выводу
          </p>
          <p class="mt-2 text-3xl font-950">
            {{ formatRevenue(parkStore.wallet?.available_balance ?? 0) }}
          </p>
          <p class="mt-2 text-sm text-white/50">
            Минимальная сумма заявки — {{ formatRevenue(minPayout) }}.
          </p>
        </div>

        <form class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur" @submit.prevent="submitPayout()">
          <h2 class="text-xl font-950">
            Заявка на вывод
          </h2>

          <div class="grid mt-4 gap-3">
            <label class="grid gap-1.5">
              <span class="text-xs text-white/42 font-900 uppercase">Сумма (₸)</span>
              <input
                v-model.number="amount"
                class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
                :min="minPayout"
                :placeholder="`От ${minPayout}`"
                step="1"
                type="number"
              >
            </label>
            <label class="grid gap-1.5">
              <span class="text-xs text-white/42 font-900 uppercase">Реквизиты</span>
              <input
                v-model="destination"
                class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
                maxlength="200"
                placeholder="Номер карты или IBAN для перевода"
                type="text"
              >
            </label>
          </div>

          <button
            :disabled="!canSubmit"
            class="mt-4 h-11 w-full rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
            type="submit"
          >
            {{ parkStore.isMutating ? 'Отправляем...' : 'Запросить вывод' }}
          </button>
        </form>
      </section>

      <section class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <h2 class="text-xl font-950">
          История заявок
        </h2>

        <div class="mt-4 overflow-hidden rounded-2xl bg-black/14">
          <div v-if="!parkStore.payouts.length" class="p-4 text-sm text-white/50">
            Заявок на вывод пока нет.
          </div>
          <div
            v-for="payout in parkStore.payouts"
            v-else
            :key="payout.id"
            class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[130px_minmax(160px,1fr)_130px_150px] md:items-center last:border-b-0"
          >
            <span class="text-sm font-950">{{ formatRevenue(payout.amount) }}</span>

            <div class="min-w-0">
              <p class="truncate text-sm text-white/62">
                {{ payout.destination || 'Реквизиты не указаны' }}
              </p>
              <p v-if="payout.status === 'rejected' && payout.rejection_reason" class="mt-0.5 truncate text-xs text-red-300/80 font-700">
                Причина: {{ payout.rejection_reason }}
              </p>
            </div>

            <span class="w-fit rounded-full px-3 py-1.5 text-xs font-900" :class="statusClass(payout.status)">
              {{ statusLabel(payout.status) }}
            </span>

            <span class="text-sm text-white/50 font-800">{{ formatDate(payout.created_at) }}</span>
          </div>
        </div>
      </section>
    </div>
  </WebPageShell>
</template>
