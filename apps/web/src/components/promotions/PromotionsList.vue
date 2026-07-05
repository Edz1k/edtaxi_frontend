<script setup lang="ts">
import type { Promotion, PromotionScope } from '~/types/promotions'
import { mediaUrl } from '~/api/client'
import { formatDate } from '~/utils/format'

withDefaults(defineProps<{
  isLoading?: boolean
  pending?: boolean
  promotions: Promotion[]
  // Пилюлю аудитории показываем только в админке (у парка scope всегда 'park').
  showAudience?: boolean
}>(), {
  isLoading: false,
  pending: false,
  showAudience: false,
})

const emit = defineEmits<{
  stop: [promotion: Promotion]
}>()

const SCOPE_LABELS: Record<PromotionScope, string> = {
  park: 'Водители парка',
  platform_driver: 'Водители',
  platform_passenger: 'Пассажиры',
}

function statusLabel(promotion: Promotion) {
  if (promotion.is_running)
    return 'Активна'
  if (!promotion.is_active)
    return 'Выключена'
  return 'Завершена'
}

function statusClass(promotion: Promotion) {
  if (promotion.is_running)
    return 'bg-emerald-500/12 text-emerald-300'
  if (!promotion.is_active)
    return 'bg-red-500/12 text-red-300'
  return 'bg-white/8 text-white/45'
}
</script>

<template>
  <section class="mt-6">
    <h2 class="text-xl font-950">
      Акции
    </h2>

    <div class="mt-3 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
      <div v-if="isLoading && !promotions.length" class="px-4 py-6 text-sm text-white/50">
        Загружаем акции...
      </div>

      <div v-else-if="!promotions.length" class="px-4 py-6 text-sm text-white/50">
        Акций ещё не было.
      </div>

      <div
        v-for="promotion in promotions"
        v-else
        :key="promotion.id"
        class="flex flex-wrap items-center gap-3 border-b border-white/6 px-4 py-4 last:border-b-0"
      >
        <img
          v-if="promotion.image_url"
          alt="Баннер акции"
          class="max-h-16 w-24 shrink-0 border border-white/10 rounded-xl object-cover"
          :src="mediaUrl(promotion.image_url)"
        >

        <div class="min-w-0 flex-1 basis-64">
          <div class="flex flex-wrap items-center gap-2">
            <p class="truncate text-sm font-900">
              {{ promotion.title }}
            </p>
            <span
              v-if="showAudience"
              class="border border-cyan-200/16 rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] text-cyan-100 font-900"
            >
              {{ SCOPE_LABELS[promotion.scope] }}
            </span>
            <span
              v-if="promotion.message"
              class="border border-amber-200/16 rounded-full bg-amber-300/10 px-2.5 py-1 text-[11px] text-amber-100 font-900"
              title="Пользователям ушёл кастомный текст рассылки вместо шаблонного"
            >
              Свой текст рассылки
            </span>
          </div>
          <p v-if="promotion.description" class="mt-0.5 truncate text-xs text-white/42">
            {{ promotion.description }}
          </p>
          <p class="mt-1 text-xs text-white/50 font-800">
            {{ promotion.target_trips }} заказов → {{ promotion.reward }} бонусов
            · {{ formatDate(promotion.starts_at) }} — {{ formatDate(promotion.ends_at) }}
          </p>
        </div>

        <span class="rounded-full px-3 py-1.5 text-xs font-900" :class="statusClass(promotion)">
          {{ statusLabel(promotion) }}
        </span>

        <button
          v-if="promotion.is_running"
          :disabled="pending"
          class="h-10 rounded-xl bg-red-500/12 px-4 text-sm text-red-300 font-900 transition active:scale-[0.98] disabled:opacity-50"
          type="button"
          @click="emit('stop', promotion)"
        >
          Остановить
        </button>
      </div>
    </div>
  </section>
</template>
