<script setup lang="ts">
import { ratePassenger } from '~/api/driver'
import { showErrorToast } from '~/api/errors'
import { useToast } from '~/composables/useToast'

const props = defineProps<{
  tripId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const toast = useToast()
const score = ref(5)
const comment = ref('')
const isSubmitting = ref(false)

async function submit() {
  if (isSubmitting.value)
    return

  isSubmitting.value = true
  try {
    await ratePassenger(props.tripId, { score: score.value, comment: comment.value.trim() })
    toast.success('Спасибо!', 'Оценка пассажира отправлена.')
    emit('close')
  }
  catch (error) {
    showErrorToast(error, 'Не удалось отправить оценку.')
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-60 flex items-end bg-black/65 px-4 pb-[calc(var(--app-safe-area-bottom)+1rem)]"
      @click.self="emit('close')"
    >
      <section class="mx-auto max-w-sm w-full rounded-3xl bg-secondary-900 p-5 text-white shadow-2xl shadow-black/30">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-xs text-main-300 font-900 uppercase">
              Поездка завершена
            </p>
            <h2 class="mt-1 text-2xl font-950">
              Оцените пассажира
            </h2>
          </div>
          <button aria-label="Закрыть оценку пассажира" class="h-11 w-11 flex items-center justify-center rounded-full bg-white/8" type="button" @click="emit('close')">
            <span class="i-mdi-close text-6" />
          </button>
        </div>

        <div class="mt-5 flex justify-center gap-1">
          <button
            v-for="star in 5"
            :key="star"
            :aria-label="`Поставить оценку ${star}`"
            class="h-11 w-11 flex items-center justify-center rounded-full transition active:scale-[0.94]"
            :class="star <= score ? 'text-main-300' : 'text-slate-600'"
            type="button"
            @click="score = star"
          >
            <span class="i-mdi-star text-8" />
          </button>
        </div>

        <textarea
          v-model="comment"
          aria-label="Комментарий к оценке пассажира"
          class="mt-5 min-h-24 w-full resize-none border border-white/10 rounded-2xl bg-white/6 p-4 text-sm outline-none focus:border-main-400"
          maxlength="500"
          name="passenger_rating_comment"
          placeholder="Комментарий, если хотите"
        />

        <button
          :disabled="isSubmitting"
          class="mt-4 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
          type="button"
          @click="submit"
        >
          {{ isSubmitting ? 'Отправляем...' : 'Отправить оценку' }}
        </button>
      </section>
    </div>
  </Teleport>
</template>
