<script setup lang="ts">
import type { Trip } from '~/types/trips'
import { useToast } from '~/composables/useToast'
import { tagsForScore } from '~/constants/ratingTags'
import { useTripsStore } from '~/stores/trips'

const props = defineProps<{ trip: Trip | null }>()
const emit = defineEmits<{ close: [] }>()

const trips = useTripsStore()
const toast = useToast()
const { t } = useI18n()

const score = ref(5)
const comment = ref('')
const tags = ref<string[]>([])

// Чипы под звёздами: 4-5 — хорошие, 1-3 — плохие; смена оценки сбрасывает выбор.
const visibleTags = computed(() => tagsForScore(score.value))
watch(score, () => {
  tags.value = []
})

function toggleTag(value: string) {
  tags.value = tags.value.includes(value)
    ? tags.value.filter(tag => tag !== value)
    : [...tags.value, value]
}

// Сбрасываем форму каждый раз, когда открывается оценка новой поездки.
watch(() => props.trip, (trip) => {
  if (trip) {
    score.value = 5
    comment.value = ''
    tags.value = []
  }
})

async function submit() {
  if (!props.trip)
    return

  await trips.submitRating(props.trip.id, score.value, comment.value, tags.value)
  toast.success(t('common.thanks'), t('rating.sent'))
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
        <section class="mx-auto max-w-sm w-full rounded-3xl app-screen p-5 text-white shadow-2xl shadow-black/30">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-xs app-accent font-900 uppercase">
                {{ t('rating.completed') }}
              </p>
              <h2 class="mt-1 text-2xl font-950">
                {{ t('rating.title') }}
              </h2>
            </div>
            <button :aria-label="t('rating.closeAria')" class="h-11 w-11 flex items-center justify-center rounded-full app-chip" type="button" @click="emit('close')">
              <span class="i-mdi-close text-6" />
            </button>
          </div>

          <div class="mt-5 flex justify-center gap-1">
            <button
              v-for="star in 5"
              :key="star"
              :aria-label="t('rating.starAria', { n: star })"
              class="h-11 w-11 flex items-center justify-center rounded-full transition active:scale-[0.94]"
              :class="star <= score ? 'app-accent' : 'text-slate-600'"
              type="button"
              @click="score = star"
            >
              <span class="i-mdi-star text-8" />
            </button>
          </div>

          <div class="mt-4 flex flex-wrap justify-center gap-1.5">
            <button
              v-for="tag in visibleTags"
              :key="tag.value"
              class="h-8 rounded-full px-3 text-xs font-800 transition active:scale-[0.96]"
              :class="tags.includes(tag.value)
                ? 'bg-main-500/22 text-main-200 light:text-main-700 border border-main-400/50'
                : 'app-card text-slate-300 light:text-slate-600 border border-transparent'"
              type="button"
              @click="toggleTag(tag.value)"
            >
              {{ t(`ratingTags.${tag.value}`) }}
            </button>
          </div>

          <textarea
            v-model="comment"
            :aria-label="t('rating.commentAria')"
            class="mt-5 min-h-24 w-full resize-none border app-border rounded-2xl app-card p-4 text-sm outline-none focus:border-main-400"
            maxlength="500"
            name="rating_comment"
            :placeholder="t('rating.commentPlaceholder')"
          />

          <button
            :disabled="trips.isRating"
            class="mt-4 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="submit"
          >
            {{ trips.isRating ? t('rating.sending') : t('rating.submit') }}
          </button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
