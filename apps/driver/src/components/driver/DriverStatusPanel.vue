<script setup lang="ts">
import { useDriverStore } from '~/stores/driver'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'

defineProps<{ trackingLabel: string, onlineBlockMessage: string, showRouteLoading: boolean, isLocationGranted: boolean }>()
const emit = defineEmits<{ primaryAction: [], toggleOnline: [] }>()

const driver = useDriverStore()
const onboarding = useDriverOnboardingStore()

const tripStep = computed(() => {
  if (!driver.hasActiveTrip)
    return null

  if (driver.activeTripStep === 'to_pickup') {
    return {
      action: 'Я на месте',
      description: 'Подъезжайте к точке посадки и отметьте прибытие.',
      icon: 'i-mdi-map-marker-check',
      title: 'Едем к пассажиру',
    }
  }

  if (driver.activeTripStep === 'arrived') {
    return {
      action: 'Начать поездку',
      description: 'Пассажир сел в автомобиль. После нажатия начнется поездка.',
      icon: 'i-mdi-play-circle',
      title: 'Ожидаем посадку',
    }
  }

  return {
    action: 'Завершить поездку',
    description: 'Доставьте пассажира до точки назначения и завершите заказ.',
    icon: 'i-mdi-flag-checkered',
    title: 'Поездка идет',
  }
})
</script>

<template>
  <section class="tg-safe-x absolute inset-x-0 bottom-[calc(var(--app-safe-area-bottom)+5.75rem)] z-20">
    <div class="mx-auto max-w-sm overflow-hidden rounded-[2rem] bg-secondary-950/82 px-4 pb-4 pt-3 shadow-[0_-18px_54px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
      <div class="mx-auto mb-4 h-1 w-12 rounded-full bg-white/12" />

      <div class="grid grid-cols-2 gap-2">
        <div class="rounded-2xl bg-white/7 px-3 py-3">
          <p class="text-xs text-slate-400 font-800">
            Доступность
          </p>
          <p class="mt-1 truncate text-sm font-950">
            {{ driver.isAvailable ? 'Готов к заказу' : 'Недоступен' }}
          </p>
        </div>

        <div class="rounded-2xl bg-white/7 px-3 py-3">
          <p class="text-xs text-slate-400 font-800">
            WebSocket
          </p>
          <p class="mt-1 truncate text-sm font-950">
            {{ trackingLabel }}
          </p>
        </div>
      </div>

      <div class="mt-4 flex items-center gap-3">
        <div class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-main-500/16 text-main-200">
          <span class="i-mdi-map-marker-path text-7" />
        </div>

        <div class="min-w-0 flex-1">
          <h2 class="truncate text-lg font-950">
            {{ tripStep?.title || 'Ожидание заказа' }}
          </h2>
          <p class="mt-1 truncate text-sm text-slate-400">
            {{ tripStep?.description || 'Активной поездки нет' }}
          </p>
        </div>
      </div>

      <div v-if="driver.hasActiveTrip && tripStep" class="mt-4 space-y-2">
        <button
          class="h-14 w-full flex items-center justify-center gap-2 rounded-2xl bg-main-500 text-sm font-950 shadow-[0_12px_30px_rgba(230,173,46,0.28)] transition active:scale-[0.99]"
          type="button"
          @click="emit('primaryAction')"
        >
          <span :class="tripStep.icon" class="text-6" />
          {{ tripStep.action }}
        </button>

        <button
          class="h-12 w-full rounded-2xl bg-red-500/12 text-sm text-red-300 font-900 transition active:scale-[0.99]"
          type="button"
          @click="driver.cancelTrip()"
        >
          Отменить заказ
        </button>
      </div>

      <button
        v-else
        :disabled="driver.isChangingStatus || driver.isRestoringActiveTrip || (!driver.isOnline && !isLocationGranted)"
        class="mt-4 h-14 w-full rounded-2xl text-base font-900 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        :class="driver.isOnline ? 'bg-red-500/12 text-red-300' : 'bg-main-500 text-white shadow-[0_12px_30px_rgba(230,173,46,0.28)]'"
        type="button"
        @click="emit('toggleOnline')"
      >
        {{ driver.isRestoringActiveTrip ? 'Восстанавливаем...' : driver.isChangingStatus ? 'Обновляем...' : driver.isOnline ? 'Уйти офлайн' : 'Выйти онлайн' }}
      </button>

      <!-- Причина отказа в выходе на линию (403 с бэка) -->
      <div v-if="onlineBlockMessage && !driver.isOnline" class="mt-3 rounded-2xl bg-amber-500/12 px-4 py-3">
        <p class="text-sm text-amber-200 font-800">
          {{ onlineBlockMessage }}
        </p>
        <RouterLink
          class="mt-2.5 h-10 flex items-center justify-center rounded-xl bg-amber-400 text-sm text-#06142f font-900 transition active:scale-[0.98]"
          to="/menu/profile/onboarding"
        >
          Пройти верификацию
        </RouterLink>
      </div>

      <RouterLink
        v-if="!onboarding.hasVehicle"
        class="mt-3 h-12 flex items-center justify-center rounded-2xl bg-white/8 text-sm text-main-100 font-900"
        to="/menu/vehicle"
      >
        Добавить автомобиль
      </RouterLink>

      <p v-if="showRouteLoading" class="mt-3 text-center text-xs text-slate-400 font-800">
        Строим маршрут заказа...
      </p>
    </div>
  </section>
</template>
