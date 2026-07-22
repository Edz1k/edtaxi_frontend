<script setup lang="ts">
import type { DriverRouteChange } from '~/types/driver'

const props = defineProps<{
  isBusy: boolean
  request: DriverRouteChange
  // Полный новый маршрут: последняя остановка в нём и есть та, куда просят
  // заехать. Отдельным полем в заявке она не приходит — бэкенд хранит список
  // целиком, чтобы две заявки не наложились друг на друга частично.
  stopAddress: string
}>()

const emit = defineEmits<{
  accept: []
  reject: []
}>()

function formatFare(value: number) {
  return `${Math.round(value).toLocaleString('ru-RU')} ₸`
}

const distanceLabel = computed(() => `${props.request.distance_km.toFixed(1)} км`)
const durationLabel = computed(() => `${Math.round(props.request.duration_min)} мин`)
</script>

<template>
  <!--
    Модалка нарочно похожа на оффер нового заказа, но это НЕ новый заказ:
    мелодию она не играет и таймером не истекает — пассажир уже в машине и ждёт
    ответа, а не уедет к другому водителю.
  -->
  <Teleport to="body">
    <div class="fixed inset-0 z-60 flex items-end bg-black/60 p-4 text-white backdrop-blur-sm">
      <section class="w-full rounded-3xl app-screen p-5 shadow-2xl">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-xs app-accent font-900 uppercase">
              Пассажир просит заехать
            </p>
            <h2 class="mt-2 text-3xl font-950">
              +{{ formatFare(request.fee) }}
            </h2>
            <p class="mt-1 text-xs app-muted font-800">
              доплата за крюк
            </p>
          </div>

          <div class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-main-500/18 text-main-200 light:text-main-700">
            <span class="i-mdi-map-marker-plus text-7" />
          </div>
        </div>

        <div class="mt-4 rounded-2xl app-card px-4 py-3">
          <p class="text-[11px] app-faint font-800 uppercase">
            Новая остановка
          </p>
          <p class="mt-1 text-sm font-900">
            {{ stopAddress }}
          </p>
        </div>

        <!-- Весь маршрут после остановки, а не прибавка: так водителю понятнее,
             сколько ещё ехать. -->
        <div class="mt-3 flex items-center gap-2 text-[13px] text-slate-300 font-800 light:text-slate-600">
          <span class="i-mdi-map-marker-distance shrink-0 text-4.5 app-accent" aria-hidden="true" />
          <span>Маршрут станет {{ distanceLabel }} · {{ durationLabel }}</span>
        </div>

        <div class="grid grid-cols-2 mt-6 gap-3">
          <button
            :disabled="isBusy"
            class="h-14 rounded-2xl bg-red-500/12 text-red-300 font-900 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="emit('reject')"
          >
            Отказаться
          </button>

          <button
            :disabled="isBusy"
            class="h-14 rounded-2xl bg-main-500 text-white font-900 shadow-lg shadow-main-500/20 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="emit('accept')"
          >
            Заеду
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
