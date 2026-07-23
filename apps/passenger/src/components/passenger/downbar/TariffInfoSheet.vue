<script setup lang="ts">
import type { EstimateTripResponse, VehicleCategory } from '~/types/trips'
import businessDetailImage from '~/assets/tariffs/details/business.png'
import comfortDetailImage from '~/assets/tariffs/details/comfort.png'
import economyDetailImage from '~/assets/tariffs/details/economy.png'
import minivanDetailImage from '~/assets/tariffs/details/minivan.png'
import motoDetailImage from '~/assets/tariffs/details/moto.png'
import { formatFare } from '~/constants/tariffs'

const props = defineProps<{
  category: VehicleCategory
  estimate: EstimateTripResponse
}>()

const emit = defineEmits<{
  close: []
}>()

const { t, tm, rt, te } = useI18n()

// Иконки не переводятся — держим их в коде, а подписи фич берём из словаря
// (tariffInfo.details.<cat>.features), сопоставляя по индексу.
const featureIconsByCategory: Partial<Record<VehicleCategory, string[]>> = {
  moto: ['i-mdi-motorbike', 'i-mdi-shield-check-outline', 'i-mdi-account-outline', 'i-mdi-weather-partly-cloudy'],
  economy: ['i-mdi-car-hatchback', 'i-mdi-snowflake', 'i-mdi-city-variant-outline', 'i-mdi-account-group-outline'],
  comfort: ['i-mdi-car-seat', 'i-mdi-snowflake', 'i-mdi-star-outline', 'i-mdi-airplane-takeoff'],
  business: ['i-mdi-sofa-single-outline', 'i-mdi-snowflake', 'i-mdi-tie', 'i-mdi-bag-suitcase-outline', 'i-mdi-calendar-star'],
  minivan: ['i-mdi-seat-passenger', 'i-mdi-bag-suitcase-outline', 'i-mdi-snowflake', 'i-mdi-hand-heart-outline', 'i-mdi-airplane-takeoff'],
}

const detailImageByCategory: Partial<Record<VehicleCategory, string>> = {
  business: businessDetailImage,
  comfort: comfortDetailImage,
  economy: economyDetailImage,
  minivan: minivanDetailImage,
  moto: motoDetailImage,
}

const details = computed(() => {
  const base = `tariffInfo.details.${props.category}`
  const icons = featureIconsByCategory[props.category] ?? []
  const featureLabels = tm(`${base}.features`) as unknown[]
  return {
    description: t(`${base}.description`),
    passengers: t(`${base}.passengers`),
    luggage: t(`${base}.luggage`),
    vehicles: t(`${base}.vehicles`),
    features: featureLabels.map((label, i) => ({ icon: icons[i] ?? '', label: rt(label as never) })),
    luggageNote: te(`${base}.luggageNote`) ? t(`${base}.luggageNote`) : undefined,
  }
})
const isMoto = computed(() => props.category === 'moto')
const titleRef = ref<HTMLElement>()
const isVisible = ref(false)
let previousBodyOverflow = ''
let isClosing = false

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
    <Transition name="tariff-sheet" @after-leave="emit('close')">
      <div
        v-if="isVisible"
        class="fixed inset-0 z-60 flex items-end justify-center bg-black/65 backdrop-blur-sm"
        @click.self="requestClose"
      >
        <section
          :aria-labelledby="`tariff-info-${category}`"
          aria-modal="true"
          class="tariff-sheet-panel tg-safe-x max-h-[90dvh] max-w-sm w-full flex flex-col overflow-hidden border border-white/10 rounded-t-[2rem] bg-secondary-900 text-white shadow-[0_-20px_60px_rgba(0,0,0,0.45)]"
          role="dialog"
        >
          <div class="shrink-0 px-5 pb-3 pt-3">
            <div class="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25" />
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="mb-1 text-[11px] text-main-300 font-900 tracking-wide uppercase">
                  {{ t('tariffInfo.aboutTariff') }}
                </p>
                <h2
                  :id="`tariff-info-${category}`"
                  ref="titleRef"
                  class="text-xl text-white font-950 outline-none"
                  tabindex="-1"
                >
                  {{ t(`tariffs.${category}.label`) }}
                </h2>
                <p class="mt-1 text-sm text-slate-400 leading-5">
                  {{ details.description }}
                </p>
              </div>
              <button
                :aria-label="t('tariffInfo.closeAria', { name: t(`tariffs.${category}.label`) })"
                class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/8 text-slate-300 transition active:scale-95"
                type="button"
                @click="requestClose"
              >
                <span class="i-mdi-close text-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            <!-- Свободно стоящая модель без карточки; остальные тарифы появятся после добавления ассетов. -->
            <div
              v-if="detailImageByCategory[category]"
              class="relative h-32 w-full flex items-center justify-center px-1"
            >
              <div class="absolute inset-x-12 bottom-3 h-3 rounded-full bg-black/30 blur-lg" />
              <img
                :src="detailImageByCategory[category]"
                :alt="isMoto ? t('tariffInfo.motoAlt') : t('tariffInfo.carAlt', { name: t(`tariffs.${category}.label`) })"
                class="relative max-h-full max-w-full object-contain drop-shadow-[0_12px_14px_rgba(0,0,0,0.3)]"
                draggable="false"
              >
            </div>

            <div class="grid grid-cols-2 mt-3 gap-2">
              <div class="rounded-[1.35rem] bg-white/6 p-3">
                <span class="i-mdi-account-multiple-outline text-5 text-main-300" aria-hidden="true" />
                <p class="mt-2 text-[11px] text-slate-400 font-750">
                  {{ t('tariffInfo.passengers') }}
                </p>
                <p class="mt-0.5 text-sm text-white font-900">
                  {{ details.passengers }}
                </p>
              </div>
              <div class="rounded-[1.35rem] bg-white/6 p-3">
                <span class="i-mdi-bag-suitcase-outline text-5 text-main-300" aria-hidden="true" />
                <p class="mt-2 text-[11px] text-slate-400 font-750">
                  {{ t('tariffInfo.luggage') }}
                </p>
                <p class="mt-0.5 text-sm text-white font-900">
                  {{ details.luggage }}
                </p>
              </div>
            </div>

            <div class="mt-3 rounded-[1.5rem] bg-white/5 p-2 space-y-0.5">
              <div
                v-for="feature in details.features"
                :key="feature.label"
                class="flex items-center gap-3 rounded-[1.05rem] px-2.5 py-2.5"
              >
                <span class="h-8 w-8 flex shrink-0 items-center justify-center rounded-xl bg-main-500/12 text-main-300">
                  <span :class="feature.icon" class="text-4.5" aria-hidden="true" />
                </span>
                <span class="text-[13px] text-slate-200 font-800 leading-4">{{ feature.label }}</span>
              </div>
            </div>

            <div class="mt-3 rounded-[1.35rem] bg-white/5 px-3.5 py-3">
              <p class="text-[11px] text-slate-400 font-800 tracking-wide uppercase">
                {{ isMoto ? t('tariffInfo.vehicleExample') : t('tariffInfo.vehicleExamples') }}
              </p>
              <p class="mt-1.5 text-[13px] text-white font-850 leading-5">
                {{ details.vehicles }}
              </p>
              <p class="mt-1 text-[11px] text-slate-500 leading-4">
                {{ isMoto ? t('tariffInfo.modelNoteMoto') : t('tariffInfo.modelNote') }}
              </p>
            </div>

            <div v-if="details.luggageNote" class="mt-3 flex items-start gap-2.5 rounded-[1.35rem] bg-amber-400/10 px-3.5 py-3 text-amber-100">
              <span class="i-mdi-information-outline mt-0.5 shrink-0 text-5 text-amber-300" aria-hidden="true" />
              <p class="text-[12px] leading-4.5">
                {{ details.luggageNote }}
              </p>
            </div>
          </div>

          <div class="shrink-0 border-t border-white/8 bg-secondary-900 px-4 pb-[calc(var(--app-safe-area-bottom)+1rem)] pt-3">
            <button
              class="h-12 w-full flex items-center justify-center gap-2 rounded-[1.25rem] bg-main-500 px-4 text-sm text-white font-950 shadow-[0_10px_26px_rgba(230,173,46,0.22)] transition active:scale-[0.99]"
              type="button"
              @click="requestClose"
            >
              <span>{{ t('tariffInfo.selected', { name: t(`tariffs.${category}.label`) }) }}</span>
              <span class="text-white/75">·</span>
              <span>{{ formatFare(estimate) }}</span>
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tariff-sheet-enter-active,
.tariff-sheet-leave-active {
  transition: opacity 220ms ease;
}

.tariff-sheet-enter-active .tariff-sheet-panel,
.tariff-sheet-leave-active .tariff-sheet-panel {
  transition:
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease;
}

.tariff-sheet-enter-from,
.tariff-sheet-leave-to {
  opacity: 0;
}

.tariff-sheet-enter-from .tariff-sheet-panel,
.tariff-sheet-leave-to .tariff-sheet-panel {
  opacity: 0.65;
  transform: translateY(2rem) scale(0.985);
}

@media (prefers-reduced-motion: reduce) {
  .tariff-sheet-enter-active,
  .tariff-sheet-leave-active,
  .tariff-sheet-enter-active .tariff-sheet-panel,
  .tariff-sheet-leave-active .tariff-sheet-panel {
    transition-duration: 1ms;
  }
}
</style>
