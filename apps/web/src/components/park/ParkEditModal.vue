<script setup lang="ts">
import type { TaxiPark, TaxiParkUpdatePayload } from '~/types/park'
import ParkModal from '~/components/park/ParkModal.vue'

const props = defineProps<{
  park: TaxiPark | null
  // Идёт сохранение — блокируем повторную отправку.
  pending: boolean
}>()

const emit = defineEmits<{
  submit: [payload: TaxiParkUpdatePayload]
}>()

const open = defineModel<boolean>({ required: true })

// Быстрая правка меняет только имя/описание/телефон. БИН и комиссия — через
// заявку с одобрением админа (ParkChangeRequestModal).
const form = reactive({ name: '', description: '', phone: '' })

watch(open, (isOpen) => {
  if (!isOpen || !props.park)
    return
  form.name = props.park.name
  form.description = props.park.description ?? ''
  form.phone = props.park.phone ?? ''
})

function submit() {
  emit('submit', {
    name: form.name || undefined,
    description: form.description || undefined,
    phone: form.phone || undefined,
  })
}
</script>

<template>
  <ParkModal v-model="open">
    <form
      class="max-w-lg w-full border border-white/10 rounded-3xl bg-#071a38 p-6 shadow-2xl"
      @submit.prevent="submit()"
    >
      <h2 class="text-xl font-950">
        Редактировать парк
      </h2>
      <p class="mt-1 text-sm text-white/50 leading-5">
        Название, описание и телефон. БИН и комиссию можно изменить отдельной заявкой.
      </p>

      <div class="grid mt-5 gap-3">
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Название</span>
          <input v-model="form.name" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" type="text">
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Описание</span>
          <textarea v-model="form.description" class="w-full border border-white/10 rounded-xl bg-white/8 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" rows="3" />
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Телефон</span>
          <input v-model="form.phone" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" type="tel">
        </label>
      </div>

      <div class="mt-5 flex gap-3">
        <button
          :disabled="pending"
          class="h-11 flex-1 rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
          type="submit"
        >
          {{ pending ? 'Сохраняем...' : 'Сохранить' }}
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
