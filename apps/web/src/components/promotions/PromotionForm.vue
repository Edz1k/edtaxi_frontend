<script setup lang="ts">
import type { CreatePromotionPayload, PromotionScope } from '~/types/promotions'

const props = withDefaults(defineProps<{
  // Подпись рядом с кнопкой запуска — кого уведомит бэкенд.
  hint: string
  pending?: boolean
  // Выбор аудитории показываем только для платформенных акций (админка).
  withAudience?: boolean
}>(), {
  pending: false,
  withAudience: false,
})

const emit = defineEmits<{
  create: [payload: CreatePromotionPayload]
}>()

const AUDIENCES: Array<{ label: string, value: PromotionScope }> = [
  { label: 'Пассажиры', value: 'platform_passenger' },
  { label: 'Водители', value: 'platform_driver' },
]

const form = reactive({
  scope: 'platform_passenger' as PromotionScope,
  title: '',
  description: '',
  target_trips: 5,
  reward: 1000,
  ends_at: '',
})

const canSubmit = computed(() => !!form.title.trim() && form.target_trips > 0 && form.reward > 0 && !!form.ends_at)

function submit() {
  if (!canSubmit.value || props.pending)
    return
  emit('create', {
    scope: props.withAudience ? form.scope : undefined,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    target_trips: form.target_trips,
    reward: form.reward,
    // datetime-local отдаёт локальное время без зоны — бэкенд ждёт RFC3339.
    ends_at: new Date(form.ends_at).toISOString(),
  })
}

// Родитель сбрасывает форму после успешного создания акции.
function reset() {
  form.scope = 'platform_passenger'
  form.title = ''
  form.description = ''
  form.target_trips = 5
  form.reward = 1000
  form.ends_at = ''
}

defineExpose({ reset })
</script>

<template>
  <section class="mt-6 border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
    <h2 class="text-xl font-950">
      Новая акция
    </h2>

    <form class="grid mt-4 gap-4" @submit.prevent="submit()">
      <div v-if="withAudience" class="grid gap-1.5">
        <span class="text-xs text-white/42 font-900 uppercase">Аудитория</span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="audience in AUDIENCES"
            :key="audience.value"
            class="h-10 rounded-xl px-4 text-sm font-900 transition active:scale-[0.97]"
            :class="form.scope === audience.value ? 'bg-cyan-400 text-#06142f' : 'bg-white/8 text-white/70 hover:bg-white/12'"
            type="button"
            @click="form.scope = audience.value"
          >
            {{ audience.label }}
          </button>
        </div>
      </div>

      <label class="grid gap-1.5">
        <span class="text-xs text-white/42 font-900 uppercase">Название</span>
        <input
          v-model="form.title"
          class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
          maxlength="200"
          placeholder="Например: 5 поездок — 1000 бонусов"
          type="text"
        >
      </label>

      <label class="grid gap-1.5">
        <span class="text-xs text-white/42 font-900 uppercase">Описание (необязательно)</span>
        <textarea
          v-model="form.description"
          class="w-full border border-white/10 rounded-xl bg-white/8 px-4 py-3 text-sm outline-none focus:border-cyan-300/40"
          maxlength="500"
          placeholder="Условия акции, которые увидят участники..."
          rows="2"
        />
      </label>

      <div class="grid gap-4 sm:grid-cols-3">
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Поездок для награды</span>
          <input
            v-model.number="form.target_trips"
            class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
            min="1"
            step="1"
            type="number"
          >
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Награда, бонусов</span>
          <input
            v-model.number="form.reward"
            class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
            min="1"
            step="50"
            type="number"
          >
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Действует до</span>
          <input
            v-model="form.ends_at"
            class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
            type="datetime-local"
          >
        </label>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <button
          :disabled="pending || !canSubmit"
          class="h-11 rounded-2xl bg-cyan-300 px-6 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
          type="submit"
        >
          {{ pending ? 'Запускаем...' : 'Запустить акцию' }}
        </button>
        <p class="max-w-md text-xs text-white/45 leading-5">
          {{ hint }}
        </p>
      </div>
    </form>
  </section>
</template>
