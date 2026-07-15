<script setup lang="ts">
import type { ParkChangeRequestPayload, TaxiPark } from '~/types/park'
import ParkModal from '~/components/park/ParkModal.vue'
import { buildParkChangePayload, parkCommissionPct } from '~/utils/park'

const props = defineProps<{
  park: TaxiPark | null
  pending: boolean
}>()

const emit = defineEmits<{
  // Payload содержит только изменённые поля; пустой объект = «ничего не
  // изменилось» — родитель показывает подсказку и не шлёт заявку.
  submit: [payload: ParkChangeRequestPayload]
}>()

const open = defineModel<boolean>({ required: true })

const form = reactive({ bin: '', commission_rate_pct: 0 })

watch(open, (isOpen) => {
  if (!isOpen || !props.park)
    return
  form.bin = props.park.bin ?? ''
  form.commission_rate_pct = parkCommissionPct(props.park)
})

function submit() {
  if (!props.park)
    return
  emit('submit', buildParkChangePayload(props.park, form))
}
</script>

<template>
  <ParkModal v-model="open">
    <form
      class="max-w-lg w-full border border-white/10 rounded-3xl bg-#071a38 p-6 shadow-2xl"
      @submit.prevent="submit()"
    >
      <h2 class="text-xl font-950">
        Изменить БИН и комиссию
      </h2>
      <p class="mt-1 text-sm text-white/50 leading-5">
        Эти поля меняются только через заявку — изменения применятся после одобрения администратором.
      </p>

      <div class="grid mt-5 gap-3">
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">БИН</span>
          <input v-model="form.bin" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" inputmode="numeric" maxlength="12" placeholder="123456789012" type="text">
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Комиссия парка (%)</span>
          <input v-model.number="form.commission_rate_pct" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" max="3" min="0" step="0.1" type="number">
          <span class="text-xs text-white/38">Максимум 3%. Комиссия платформы (7%) добавляется отдельно.</span>
        </label>
      </div>

      <div class="mt-5 flex gap-3">
        <button
          :disabled="pending"
          class="h-11 flex-1 rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
          type="submit"
        >
          {{ pending ? 'Отправляем...' : 'Отправить заявку' }}
        </button>
        <button
          class="h-11 border border-white/12 rounded-2xl bg-white/8 px-5 text-sm font-900 transition hover:bg-white/12"
          type="button"
          @click="open = false"
        >
          Отмена
        </button>
      </div>
    </form>
  </ParkModal>
</template>
