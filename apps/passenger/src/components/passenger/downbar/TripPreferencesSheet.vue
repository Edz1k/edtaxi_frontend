<script setup lang="ts">
import { useTripsStore } from '~/stores/trips'

const props = defineProps<{
  friendOrder: boolean
  isMotoSelected: boolean
  surchargeChildSeat: number
  surchargePets: number
}>()

const emit = defineEmits<{
  'close': []
  'update:friendOrder': [value: boolean]
}>()

const trips = useTripsStore()
const titleRef = ref<HTMLElement>()
const isVisible = ref(false)
let previousBodyOverflow = ''
let isClosing = false

function surchargeLabel(amount: number) {
  return amount > 0 ? `+${amount.toLocaleString('ru-RU')} ₸` : ''
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape')
    requestClose()
}

function requestClose() {
  if (isClosing)
    return
  isClosing = true
  isVisible.value = false
}

onMounted(() => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown)
  nextTick(() => {
    isVisible.value = true
    titleRef.value?.focus()
  })
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="bottom-sheet" @after-leave="emit('close')">
      <div
        v-if="isVisible"
        class="fixed inset-0 z-60 flex items-end justify-center bg-black/65 backdrop-blur-sm"
        @click.self="requestClose"
      >
        <section
          aria-labelledby="trip-preferences-title"
          aria-modal="true"
          class="bottom-sheet-panel tg-safe-x max-h-[88dvh] max-w-sm w-full flex flex-col overflow-hidden border border-white/10 rounded-t-[2rem] bg-secondary-900 text-white shadow-[0_-20px_60px_rgba(0,0,0,0.45)]"
          role="dialog"
        >
          <div class="shrink-0 px-5 pb-3 pt-3">
            <div class="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25" />
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2
                  id="trip-preferences-title"
                  ref="titleRef"
                  class="text-lg text-white font-950 outline-none"
                  tabindex="-1"
                >
                  Пожелания к поездке
                </h2>
                <p class="mt-0.5 text-xs text-slate-400">
                  Выберите всё, что важно учесть водителю
                </p>
              </div>
              <button
                aria-label="Закрыть пожелания"
                class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-slate-300 transition active:scale-95"
                type="button"
                @click="requestClose"
              >
                <span class="i-mdi-close text-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
            <div class="rounded-[1.5rem] bg-white/5 p-2 space-y-1">
              <button
                class="w-full flex items-center gap-3 rounded-[1.15rem] px-2.5 py-3 text-left transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                :aria-pressed="trips.tripOptions.childSeat"
                :disabled="props.isMotoSelected"
                @click="trips.setTripOption('childSeat', !trips.tripOptions.childSeat)"
              >
                <span
                  class="h-5.5 w-5.5 flex shrink-0 items-center justify-center border rounded-md transition"
                  :class="trips.tripOptions.childSeat ? 'border-main-400 bg-main-500 text-white' : 'border-white/25 bg-transparent'"
                >
                  <span v-if="trips.tripOptions.childSeat" class="i-mdi-check text-4" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1 text-sm text-white font-850">Детское кресло</span>
                <span v-if="surchargeLabel(props.surchargeChildSeat)" class="shrink-0 text-xs text-main-300 font-900">
                  {{ surchargeLabel(props.surchargeChildSeat) }}
                </span>
              </button>

              <button
                class="w-full flex items-center gap-3 rounded-[1.15rem] px-2.5 py-3 text-left transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                :aria-pressed="trips.tripOptions.pets"
                :disabled="props.isMotoSelected"
                @click="trips.setTripOption('pets', !trips.tripOptions.pets)"
              >
                <span
                  class="h-5.5 w-5.5 flex shrink-0 items-center justify-center border rounded-md transition"
                  :class="trips.tripOptions.pets ? 'border-main-400 bg-main-500 text-white' : 'border-white/25 bg-transparent'"
                >
                  <span v-if="trips.tripOptions.pets" class="i-mdi-check text-4" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1 text-sm text-white font-850">Поездка с животным</span>
                <span v-if="surchargeLabel(props.surchargePets)" class="shrink-0 text-xs text-main-300 font-900">
                  {{ surchargeLabel(props.surchargePets) }}
                </span>
              </button>

              <p v-if="props.isMotoSelected" class="px-2.5 pb-2 text-[11px] text-amber-300/90 leading-4">
                Детское кресло и поездка с животным недоступны на мототакси.
              </p>

              <button
                class="w-full flex items-center gap-3 rounded-[1.15rem] px-2.5 py-3 text-left transition active:scale-[0.99]"
                type="button"
                :aria-pressed="trips.tripOptions.accessible"
                @click="trips.setTripOption('accessible', !trips.tripOptions.accessible)"
              >
                <span
                  class="h-5.5 w-5.5 flex shrink-0 items-center justify-center border rounded-md transition"
                  :class="trips.tripOptions.accessible ? 'border-main-400 bg-main-500 text-white' : 'border-white/25 bg-transparent'"
                >
                  <span v-if="trips.tripOptions.accessible" class="i-mdi-check text-4" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1 text-sm text-white font-850">Особые потребности</span>
              </button>

              <button
                class="w-full flex items-center gap-3 rounded-[1.15rem] px-2.5 py-3 text-left transition active:scale-[0.99]"
                type="button"
                :aria-expanded="props.friendOrder"
                :aria-pressed="props.friendOrder"
                @click="emit('update:friendOrder', !props.friendOrder)"
              >
                <span
                  class="h-5.5 w-5.5 flex shrink-0 items-center justify-center border rounded-md transition"
                  :class="props.friendOrder ? 'border-main-400 bg-main-500 text-white' : 'border-white/25 bg-transparent'"
                >
                  <span v-if="props.friendOrder" class="i-mdi-check text-4" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1 text-sm text-white font-850">Заказ другому</span>
                <span
                  class="i-mdi-chevron-down shrink-0 text-5 text-slate-400 transition"
                  :class="props.friendOrder ? 'rotate-180' : ''"
                  aria-hidden="true"
                />
              </button>

              <div v-if="props.friendOrder" class="px-2.5 pb-2 space-y-2">
                <input
                  :value="trips.tripOptions.friendName"
                  aria-label="Имя пассажира"
                  class="h-11 w-full rounded-[1.05rem] bg-white/7 px-3.5 text-sm text-white font-800 outline-none transition focus:bg-white/11 placeholder:text-slate-500"
                  maxlength="100"
                  placeholder="Имя пассажира"
                  type="text"
                  @input="trips.setTripOption('friendName', ($event.target as HTMLInputElement).value)"
                >
                <input
                  :value="trips.tripOptions.friendPhone"
                  aria-label="Телефон пассажира"
                  class="h-11 w-full rounded-[1.05rem] bg-white/7 px-3.5 text-sm text-white font-800 outline-none transition focus:bg-white/11 placeholder:text-slate-500"
                  inputmode="tel"
                  maxlength="32"
                  placeholder="Телефон пассажира"
                  type="tel"
                  @input="trips.setTripOption('friendPhone', ($event.target as HTMLInputElement).value)"
                >
                <p class="px-1 text-[11px] text-slate-400 leading-4">
                  Водитель увидит имя и телефон пассажира.
                </p>
              </div>
            </div>

            <label class="mt-3 block px-1 text-xs text-slate-400 font-800">
              Комментарий водителю
            </label>
            <textarea
              :value="trips.tripComment"
              aria-label="Комментарий водителю"
              class="mt-2 min-h-20 w-full resize-none rounded-[1.35rem] bg-white/6 px-3.5 py-3 text-sm text-white font-800 outline-none transition focus:bg-white/10 placeholder:text-slate-500"
              maxlength="500"
              placeholder="Подъезд, домофон, ориентир..."
              rows="3"
              @input="trips.setTripComment(($event.target as HTMLTextAreaElement).value)"
            />
          </div>

          <div class="shrink-0 border-t border-white/8 bg-secondary-900 px-4 pb-[calc(var(--app-safe-area-bottom)+1rem)] pt-3">
            <button
              class="h-12 w-full rounded-[1.25rem] bg-main-500 text-sm text-white font-950 shadow-[0_10px_26px_rgba(230,173,46,0.22)] transition active:scale-[0.99]"
              type="button"
              @click="requestClose"
            >
              Готово
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bottom-sheet-enter-active,
.bottom-sheet-leave-active {
  transition: opacity 220ms ease;
}

.bottom-sheet-enter-active .bottom-sheet-panel,
.bottom-sheet-leave-active .bottom-sheet-panel {
  transition:
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease;
}

.bottom-sheet-enter-from,
.bottom-sheet-leave-to {
  opacity: 0;
}

.bottom-sheet-enter-from .bottom-sheet-panel,
.bottom-sheet-leave-to .bottom-sheet-panel {
  opacity: 0.65;
  transform: translateY(2rem) scale(0.985);
}

@media (prefers-reduced-motion: reduce) {
  .bottom-sheet-enter-active,
  .bottom-sheet-leave-active,
  .bottom-sheet-enter-active .bottom-sheet-panel,
  .bottom-sheet-leave-active .bottom-sheet-panel {
    transition-duration: 1ms;
  }
}
</style>
