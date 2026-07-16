<script setup lang="ts">
import type { RecentRider } from '~/composables/passenger/useRecentRiders'
import PhoneInput from '~/components/auth/PhoneInput.vue'
import { isKazakhstanPhoneComplete, toKazakhstanE164 } from '~/composables/auth/phone'
import { useRecentRiders } from '~/composables/passenger/useRecentRiders'

// «Кто поедет?» — всплывает при заказе, когда точка подачи заметно далеко от
// реальной геопозиции: скорее всего, машину заказывают не себе. Выбор из
// адресной книги невозможен (Telegram не отдаёт контакты мини-аппу), поэтому
// номер вводится вручную, а роль «списка контактов» играют недавние получатели.
const props = defineProps<{
  distanceMeters: null | number
  pending?: boolean
}>()

const emit = defineEmits<{
  close: []
  me: []
  other: [rider: RecentRider]
}>()

const { recent } = useRecentRiders()

const isOtherOpen = ref(false)
const name = ref('')
const phoneInput = ref('')

const canConfirmOther = computed(() => isKazakhstanPhoneComplete(phoneInput.value))

// Округляем: точность GPS всё равно десятки метров, точная цифра тут ни к чему.
const distanceText = computed(() => {
  const meters = props.distanceMeters
  if (meters === null)
    return ''

  return meters >= 1000
    ? `${(meters / 1000).toFixed(1).replace('.', ',')} км`
    : `${Math.round(meters / 50) * 50} м`
})

function confirmOther() {
  if (!canConfirmOther.value || props.pending)
    return

  emit('other', { name: name.value.trim(), phone: toKazakhstanE164(phoneInput.value) })
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-60 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div class="tg-safe-x max-w-sm w-full border border-white/10 rounded-t-[2rem] bg-secondary-900 p-5 pb-[calc(var(--app-safe-area-bottom)+1.25rem)] text-white">
        <div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/25" />

        <h3 class="text-lg font-950">
          Кто поедет?
        </h3>
        <p class="mt-1 text-xs text-slate-400 leading-4">
          <template v-if="distanceText">
            Точка подачи в {{ distanceText }} от вас — похоже, машина нужна не вам.
          </template>
          <template v-else>
            Похоже, машина нужна не вам.
          </template>
          Водитель будет знать, кого встречать.
        </p>

        <!-- Выбор: я или другой человек -->
        <div v-if="!isOtherOpen" class="mt-4 space-y-2">
          <button
            :disabled="pending"
            class="h-14 w-full flex items-center gap-3 rounded-2xl bg-main-500 px-4 text-left transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="emit('me')"
          >
            <span class="i-mdi-account text-6" />
            <span class="text-sm font-950">Я поеду</span>
          </button>

          <button
            :disabled="pending"
            class="h-14 w-full flex items-center gap-3 rounded-2xl bg-white/8 px-4 text-left transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="isOtherOpen = true"
          >
            <span class="i-mdi-account-plus-outline text-6 text-main-200" />
            <span class="text-sm font-950">Поедет другой человек</span>
            <span class="i-mdi-chevron-right ml-auto text-6 text-slate-500" />
          </button>
        </div>

        <!-- Данные пассажира -->
        <div v-else class="mt-4">
          <!-- Недавние получатели — замена выбору из контактов -->
          <div v-if="recent.length" class="mb-4">
            <p class="mb-2 text-xs text-slate-400 font-800 uppercase">
              Недавние
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="rider in recent"
                :key="rider.phone"
                :disabled="pending"
                class="h-9 flex items-center gap-1.5 rounded-full bg-white/8 pl-3 pr-3.5 text-xs font-800 transition active:scale-95 disabled:opacity-60"
                type="button"
                @click="emit('other', rider)"
              >
                <span class="i-mdi-account-circle-outline text-4.5 text-main-200" />
                {{ rider.name || rider.phone }}
              </button>
            </div>
          </div>

          <label class="mb-2 block text-sm text-slate-300 font-600" for="rider-name">
            Имя пассажира
          </label>
          <input
            id="rider-name"
            v-model="name"
            class="mb-4 h-14 w-full border border-white/10 rounded-2xl bg-white/5 px-4 text-lg text-white font-700 outline-none transition focus:border-main-400 focus:bg-white/8 placeholder:text-slate-600"
            maxlength="100"
            placeholder="Необязательно"
            type="text"
          >

          <PhoneInput v-model="phoneInput" label="Номер пассажира" />

          <button
            :disabled="pending || !canConfirmOther"
            class="mt-4 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="confirmOther"
          >
            {{ pending ? 'Заказываем...' : 'Заказать для него' }}
          </button>

          <button
            class="mt-2 h-11 w-full text-xs text-slate-400 font-800"
            type="button"
            @click="isOtherOpen = false"
          >
            Назад
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
