<script setup lang="ts">
import type { ParkChangeRequest, ParkStatus, TaxiPark } from '~/types/park'
import { parkCommissionPct } from '~/utils/park'

const props = defineProps<{
  park: TaxiPark
  // Активная (pending) заявка на изменение БИН/комиссии — баннер + блокировка кнопки.
  pendingChange: ParkChangeRequest | null
  isPeeking: boolean
}>()

defineEmits<{
  // Открыть модалку заявки на изменение БИН/комиссии.
  openChange: []
}>()

const statusLabels: Record<ParkStatus, string> = {
  approved: 'Проверен',
  pending: 'Ожидает',
  rejected: 'Отклонён',
}

const statusClasses: Record<ParkStatus, string> = {
  approved: 'bg-emerald-500/12 text-emerald-300',
  pending: 'bg-amber-500/12 text-amber-300',
  rejected: 'bg-red-500/12 text-red-300',
}

const commissionPct = computed(() => parkCommissionPct(props.park))

// Краткое описание запрошенных изменений для баннера «на рассмотрении».
const pendingChangeSummary = computed(() => {
  const req = props.pendingChange
  if (!req)
    return ''
  const parts: string[] = []
  if (req.requested_bin)
    parts.push(`БИН → ${req.requested_bin}`)
  if (req.requested_commission_rate != null)
    parts.push(`Комиссия → ${+(req.requested_commission_rate * 100).toFixed(1)}%`)
  return parts.join(' · ')
})
</script>

<template>
  <section class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-white/42 font-900 uppercase">
          Парк
        </p>
        <h2 class="mt-1 text-2xl font-950">
          {{ park.name }}
        </h2>
        <p v-if="park.description" class="mt-1 text-sm text-white/62 leading-5">
          {{ park.description }}
        </p>
      </div>

      <span class="rounded-xl px-3 py-2 text-xs font-900" :class="statusClasses[park.status]">
        {{ statusLabels[park.status] }}
      </span>
    </div>

    <!-- Реквизиты: БИН / телефон / комиссия -->
    <div class="grid mt-4 gap-3 sm:grid-cols-3">
      <div class="rounded-2xl bg-black/14 px-4 py-3">
        <p class="text-xs text-white/42 font-900 uppercase">
          БИН
        </p>
        <p class="mt-0.5 text-sm font-900">
          {{ park.bin || '—' }}
        </p>
      </div>
      <div class="rounded-2xl bg-black/14 px-4 py-3">
        <p class="text-xs text-white/42 font-900 uppercase">
          Телефон
        </p>
        <p class="mt-0.5 text-sm font-900">
          {{ park.phone || '—' }}
        </p>
      </div>
      <div class="rounded-2xl bg-black/14 px-4 py-3">
        <p class="text-xs text-white/42 font-900 uppercase">
          Комиссия парка
        </p>
        <p class="mt-0.5 text-sm font-900">
          {{ commissionPct }}%
        </p>
      </div>
    </div>

    <!-- Заявка на изменение БИН/комиссии -->
    <div v-if="!isPeeking" class="mt-4">
      <div v-if="pendingChange" class="flex flex-wrap items-center justify-between gap-3 border border-amber-300/18 rounded-2xl bg-amber-300/8 p-4">
        <div>
          <p class="text-xs text-amber-300/80 font-900 uppercase">
            Заявка на рассмотрении
          </p>
          <p class="mt-1 text-sm text-white/70 leading-5">
            {{ pendingChangeSummary }}
          </p>
        </div>
        <span class="i-mdi-clock-outline text-6 text-amber-300" />
      </div>
      <button
        v-else
        class="h-10 inline-flex items-center gap-2 border border-white/12 rounded-xl bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12"
        type="button"
        @click="$emit('openChange')"
      >
        <span class="i-mdi-file-document-edit-outline text-4.5 text-cyan-200" />
        Изменить БИН и комиссию
      </button>
    </div>

    <div v-if="park.status === 'rejected'" class="mt-4 border border-red-400/18 rounded-2xl bg-red-500/8 p-4">
      <p class="text-xs text-red-300/80 font-900 uppercase">
        Заявка отклонена
      </p>
      <p class="mt-1 text-sm text-white/70 leading-5">
        {{ park.rejection_reason || 'Причина не указана. Свяжитесь с поддержкой или подайте заявку повторно.' }}
      </p>
    </div>
  </section>
</template>
