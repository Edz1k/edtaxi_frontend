<script setup lang="ts">
import type { Trip } from '~/types/trips'
import { useToast } from '~/composables/useToast'
import { useTripsStore } from '~/stores/trips'

const props = defineProps<{ trip: Trip | null }>()
const emit = defineEmits<{ close: [] }>()

const trips = useTripsStore()
const toast = useToast()

const reason = ref('')

const isReasonValid = computed(() => reason.value.trim().length >= 3)

watch(() => props.trip, () => {
  reason.value = ''
})

async function submit() {
  if (!props.trip || !isReasonValid.value)
    return

  await trips.submitComplaint(props.trip.id, reason.value.trim())
  toast.success('Жалоба отправлена', 'Мы рассмотрим её и примем меры.')
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="trip"
        class="fixed inset-0 z-60 flex items-end bg-black/65 px-4 pb-[calc(var(--app-safe-area-bottom)+1rem)]"
        @click.self="emit('close')"
      >
        <section class="mx-auto max-w-sm w-full rounded-3xl bg-secondary-900 p-5 text-white shadow-2xl shadow-black/30">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-xs text-red-300 font-900 uppercase">
                Жалоба
              </p>
              <h2 class="mt-1 text-2xl font-950">
                Пожаловаться на водителя
              </h2>
            </div>
            <button aria-label="Закрыть жалобу" class="h-11 w-11 flex items-center justify-center rounded-full bg-white/8" type="button" @click="emit('close')">
              <span class="i-mdi-close text-6" />
            </button>
          </div>

          <p class="mt-3 text-sm text-slate-400 leading-5">
            Опишите, что произошло. Жалобу рассмотрит служба поддержки.
          </p>

          <textarea
            v-model="reason"
            aria-label="Причина жалобы"
            class="mt-4 min-h-28 w-full resize-none border border-white/10 rounded-2xl bg-white/6 p-4 text-sm outline-none focus:border-red-400"
            maxlength="1000"
            name="complaint_reason"
            placeholder="Например: водитель вёл себя грубо"
          />

          <button
            :disabled="trips.isFilingComplaint || !isReasonValid"
            class="mt-4 h-13 w-full rounded-2xl bg-red-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="submit"
          >
            {{ trips.isFilingComplaint ? 'Отправляем...' : 'Отправить жалобу' }}
          </button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
