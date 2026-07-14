<script setup lang="ts">
import type { Promotion, PromotionParticipantsResponse, PromotionScope } from '~/types/promotions'
import { mediaUrl } from '~/api/client'
import { formatDate } from '~/utils/format'

const props = withDefaults(defineProps<{
  isLoading?: boolean
  pending?: boolean
  promotions: Promotion[]
  // Пилюлю аудитории показываем только в админке (у парка scope всегда 'park').
  showAudience?: boolean
  // Наградный контур manual-акций: страница передаёт свои API-функции
  // (парк — /park/promotions/*, админ — /admin/promotions/*). Без них блок
  // участников и кнопка наград не показываются.
  loadParticipants?: (id: string) => Promise<PromotionParticipantsResponse>
  sendRewards?: (id: string) => Promise<{ awarded: number, message: string }>
}>(), {
  isLoading: false,
  pending: false,
  showAudience: false,
  loadParticipants: undefined,
  sendRewards: undefined,
})

const emit = defineEmits<{
  stop: [promotion: Promotion]
}>()

const SCOPE_LABELS: Record<PromotionScope, string> = {
  park: 'Водители парка',
  platform_driver: 'Водители',
  platform_passenger: 'Пассажиры',
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'Все водители',
  platform: 'Водители платформы',
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

// Статус-бар акции: сколько времени акции уже прошло (start → end).
function timeProgress(promotion: Promotion) {
  const start = new Date(promotion.starts_at).getTime()
  const end = new Date(promotion.ends_at).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return 100
  const ratio = (Date.now() - start) / (end - start)
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100)
}

// Кнопка «Отправить награды»: только завершённые manual-акции без выдачи.
function canSendRewards(promotion: Promotion) {
  return Boolean(props.sendRewards)
    && promotion.award_mode === 'manual'
    && promotion.is_finished
    && !promotion.rewards_sent_at
}

// --- Участники (ленивая подгрузка по разворачиванию карточки) ---

const expandedId = ref<null | string>(null)
const participants = reactive<Record<string, PromotionParticipantsResponse>>({})
const participantsLoading = ref(false)

async function toggleParticipants(promotion: Promotion) {
  if (expandedId.value === promotion.id) {
    expandedId.value = null
    return
  }
  expandedId.value = promotion.id
  if (!props.loadParticipants || participants[promotion.id])
    return
  participantsLoading.value = true
  try {
    participants[promotion.id] = await props.loadParticipants(promotion.id)
  }
  catch {
    expandedId.value = null
  }
  finally {
    participantsLoading.value = false
  }
}

// --- Отправка наград ---

const sendingId = ref<null | string>(null)
const sendResult = reactive<Record<string, string>>({})
const sendError = reactive<Record<string, string>>({})

async function onSendRewards(promotion: Promotion) {
  if (!props.sendRewards || sendingId.value)
    return
  sendingId.value = promotion.id
  delete sendError[promotion.id]
  try {
    const result = await props.sendRewards(promotion.id)
    // Локально помечаем выдачу, чтобы кнопка исчезла без перезагрузки списка.
    promotion.rewards_sent_at = new Date().toISOString()
    sendResult[promotion.id] = `Награды отправлены: ${result.awarded}`
    // Список участников устарел (появились награждённые) — сбрасываем кэш.
    delete participants[promotion.id]
  }
  catch (error) {
    const message = error instanceof Error ? error.message : ''
    sendError[promotion.id] = message.includes('balance')
      ? 'На балансе парка не хватает на все награды — пополните баланс и повторите'
      : 'Не удалось отправить награды, попробуйте ещё раз'
  }
  finally {
    sendingId.value = null
  }
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
        class="border-b border-white/6 px-4 py-4 last:border-b-0"
      >
        <div class="flex flex-wrap items-center gap-3">
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
                v-if="showAudience && promotion.scope === 'platform_driver'"
                class="border border-white/12 rounded-full bg-white/6 px-2.5 py-1 text-[11px] text-white/60 font-900"
              >
                {{ AUDIENCE_LABELS[promotion.audience] ?? promotion.audience }}
              </span>
              <span
                v-if="promotion.message"
                class="border border-amber-200/16 rounded-full bg-amber-300/10 px-2.5 py-1 text-[11px] text-amber-100 font-900"
                title="Пользователям ушёл кастомный текст рассылки вместо шаблонного"
              >
                Свой текст рассылки
              </span>
              <span
                v-if="promotion.rewards_sent_at"
                class="border border-emerald-200/16 rounded-full bg-emerald-300/10 px-2.5 py-1 text-[11px] text-emerald-200 font-900"
              >
                Награды отправлены
              </span>
            </div>
            <p v-if="promotion.description" class="mt-0.5 truncate text-xs text-white/42">
              {{ promotion.description }}
            </p>
            <p class="mt-1 text-xs text-white/50 font-800">
              {{ promotion.target_trips }} заказов → {{ promotion.reward }} бонусов
              · {{ formatDate(promotion.starts_at) }} — {{ formatDate(promotion.ends_at) }}
              <template v-if="promotion.award_mode === 'manual'">
                · награды — после завершения
              </template>
            </p>
            <!-- Статус-бар времени акции -->
            <div class="mt-2 h-1.5 max-w-72 overflow-hidden rounded-full bg-white/8">
              <div
                class="h-full rounded-full transition-all"
                :class="promotion.is_running ? 'bg-emerald-400/80' : 'bg-white/25'"
                :style="{ width: `${timeProgress(promotion)}%` }"
              />
            </div>
          </div>

          <span class="rounded-full px-3 py-1.5 text-xs font-900" :class="statusClass(promotion)">
            {{ statusLabel(promotion) }}
          </span>

          <button
            v-if="loadParticipants"
            class="h-10 rounded-xl bg-white/8 px-4 text-sm text-white/70 font-900 transition active:scale-[0.98] hover:text-white"
            type="button"
            @click="toggleParticipants(promotion)"
          >
            {{ expandedId === promotion.id ? 'Скрыть' : 'Участники' }}
          </button>

          <button
            v-if="canSendRewards(promotion)"
            :disabled="sendingId === promotion.id"
            class="h-10 rounded-xl bg-emerald-500/14 px-4 text-sm text-emerald-300 font-900 transition active:scale-[0.98] disabled:opacity-50"
            type="button"
            @click="onSendRewards(promotion)"
          >
            {{ sendingId === promotion.id ? 'Отправляем...' : 'Отправить награды' }}
          </button>

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

        <p v-if="sendResult[promotion.id]" class="mt-2 text-xs text-emerald-300 font-800">
          {{ sendResult[promotion.id] }}
        </p>
        <p v-if="sendError[promotion.id]" class="mt-2 text-xs text-red-300 font-800">
          {{ sendError[promotion.id] }}
        </p>

        <!-- Участники с прогрессом -->
        <div v-if="expandedId === promotion.id" class="mt-3 border border-white/8 rounded-2xl bg-white/4 p-3">
          <p v-if="participantsLoading && !participants[promotion.id]" class="text-xs text-white/50">
            Загружаем участников...
          </p>
          <template v-else-if="participants[promotion.id]">
            <p class="text-xs text-white/60 font-800">
              Выполнили условие: {{ participants[promotion.id].completed_count }} из {{ participants[promotion.id].total }}
            </p>
            <p v-if="!participants[promotion.id].participants.length" class="mt-2 text-xs text-white/45">
              Участников с прогрессом пока нет.
            </p>
            <div
              v-for="participant in participants[promotion.id].participants"
              :key="participant.user_id"
              class="mt-2 flex items-center gap-3 border-t border-white/6 pt-2 first:border-t-0"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs text-white/80 font-900">
                  {{ participant.name || participant.phone || 'Водитель' }}
                </p>
                <div class="mt-1 h-1.5 max-w-56 overflow-hidden rounded-full bg-white/8">
                  <div
                    class="h-full rounded-full"
                    :class="participant.completed ? 'bg-emerald-400/80' : 'bg-cyan-300/70'"
                    :style="{ width: `${Math.min(100, Math.round(participant.trips / promotion.target_trips * 100))}%` }"
                  />
                </div>
              </div>
              <span class="shrink-0 text-xs text-white/55 font-800">
                {{ participant.trips }} / {{ promotion.target_trips }}
              </span>
              <span
                v-if="participant.awarded"
                class="shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] text-emerald-300 font-900"
              >
                Награждён
              </span>
              <span
                v-else-if="participant.completed"
                class="shrink-0 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] text-amber-200 font-900"
              >
                Выполнил
              </span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>
