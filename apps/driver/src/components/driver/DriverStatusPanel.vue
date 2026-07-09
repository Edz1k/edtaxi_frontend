<script setup lang="ts">
import { useBottomSheet } from '@edtaxi/shared/composables/useBottomSheet'
import { useDriverStore } from '~/stores/driver'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'
import { useTripChatStore } from '~/stores/tripChat'
import { categoryLabel } from '~/utils/vehicleCategories'

const props = defineProps<{
  trackingStatus: 'closed' | 'connecting' | 'open'
  onlineBlockMessage: string
  showRouteLoading: boolean
  isLocationGranted: boolean
}>()
const emit = defineEmits<{ primaryAction: [], toggleOnline: [] }>()

// Панель — шторка (как у пассажира): свайп за грабер вниз сворачивает её к
// карте (peek), тап по карте тоже приопускает (collapseToMap из map.vue);
// свайп/тап по граберу возвращает рабочую высоту.
const boundsEl = ref<HTMLElement>()
const sheetEl = ref<HTMLElement>()
const handleEl = ref<HTMLElement>()
const contentEl = ref<HTMLElement>()

const { active, sheetStyle, snapTo } = useBottomSheet({
  boundsEl,
  contentEl,
  handleEl,
  initialSnap: 'half',
  sheetEl,
  snaps: () => ['peek', 'half'],
})

defineExpose({
  collapseToMap: () => snapTo('peek'),
})

function onHandleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    snapTo('half')
  }
  else if (event.key === 'ArrowDown') {
    event.preventDefault()
    snapTo('peek')
  }
}

// 403 из-за отсутствия таксопарка решается выбором парка, а не верификацией —
// ведём водителя на нужный экран по содержимому сообщения с бэка.
const onlineBlockLink = computed(() =>
  props.onlineBlockMessage.toLowerCase().includes('таксопарк')
    ? { label: 'Выбрать таксопарк', to: '/menu/parks' }
    : { label: 'Пройти верификацию', to: '/menu/profile/onboarding' },
)

const driver = useDriverStore()
const onboarding = useDriverOnboardingStore()
const tripChat = useTripChatStore()

// Платное ожидание: после «Я на месте» показываем водителю таймер и
// накапливающуюся надбавку — правила приходят с бэка в объекте поездки.
const nowTick = ref(Date.now())
let waitTimer: number | undefined
const isArrivedStep = computed(() => driver.activeTripStep === 'arrived')
watch(isArrivedStep, (arrived) => {
  if (arrived && waitTimer === undefined) {
    waitTimer = window.setInterval(() => {
      nowTick.value = Date.now()
    }, 1000)
  }
  else if (!arrived && waitTimer !== undefined) {
    window.clearInterval(waitTimer)
    waitTimer = undefined
  }
}, { immediate: true })
onBeforeUnmount(() => {
  if (waitTimer !== undefined)
    window.clearInterval(waitTimer)
})

const waitingInfo = computed(() => {
  const trip = driver.activeTrip
  if (!trip || !isArrivedStep.value || !trip.arrived_at)
    return null

  const freeMinutes = trip.waiting_free_minutes ?? 3
  const perMinute = trip.waiting_per_minute_fee ?? 100
  const waitedSec = Math.max(0, Math.floor((nowTick.value - new Date(trip.arrived_at).getTime()) / 1000))
  const mm = Math.floor(waitedSec / 60)
  const ss = String(waitedSec % 60).padStart(2, '0')
  const paidMinutes = Math.max(0, Math.floor(waitedSec / 60) - freeMinutes)
  const fee = paidMinutes * perMinute

  return {
    accent: fee > 0,
    text: fee > 0
      ? `Ожидание ${mm}:${ss} · платное: +${fee.toLocaleString('ru-RU')} ₸`
      : `Ожидание ${mm}:${ss} · бесплатно до ${freeMinutes}:00, дальше +${perMinute} ₸/мин`,
  }
})

// Нельзя выйти на линию без выбранного тарифа — если доступные тарифы уже
// загружены, но ни один не активен.
const blockedByNoCategory = computed(() =>
  !driver.isOnline && driver.availableCategories.length > 0 && driver.activeCategories.length === 0,
)

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

// Шапка панели: одно человеческое состояние вместо тех-карточек
// («Доступность» / «WebSocket»): этап поездки, «на линии», «не на линии».
const statusMeta = computed(() => {
  if (tripStep.value) {
    return {
      icon: tripStep.value.icon,
      iconClass: 'bg-main-500/16 text-main-200',
      pulse: false,
      subtitle: tripStep.value.description,
      title: tripStep.value.title,
    }
  }

  if (driver.isOnline) {
    return {
      icon: 'i-mdi-radar',
      iconClass: 'bg-emerald-500/14 text-emerald-300',
      pulse: true,
      subtitle: 'Ждём подходящий заказ рядом',
      title: 'Вы на линии',
    }
  }

  return {
    icon: 'i-mdi-steering',
    iconClass: 'bg-white/7 text-slate-300',
    pulse: false,
    subtitle: 'Выберите тарифы и выходите на заказы',
    title: 'Вы не на линии',
  }
})

// Статус сокета наружу не показываем — только человеческое предупреждение,
// когда связь на линии реально деградировала и заказы могут не доходить.
const connectionHint = computed(() => {
  if (!driver.isOnline || props.trackingStatus === 'open')
    return ''
  return props.trackingStatus === 'connecting'
    ? 'Подключаемся к серверу заказов…'
    : 'Нет связи с сервером заказов — переподключаемся…'
})

// Свёрнутая шторка (peek): вместо обрезанного верха контента — компактная
// пилюля-сводка состояния; тап возвращает рабочую высоту.
const isPeekPillVisible = computed(() => active.value === 'peek')

const peekPill = computed(() => {
  if (tripStep.value) {
    return {
      icon: tripStep.value.icon,
      pulse: false,
      subtitle: waitingInfo.value?.text ?? tripStep.value.description,
      title: tripStep.value.title,
    }
  }

  if (driver.isOnline)
    return { icon: '', pulse: true, subtitle: 'Ждём подходящий заказ рядом', title: 'Вы на линии' }

  return { icon: 'i-mdi-steering', pulse: false, subtitle: 'Тарифы и выход на линию', title: 'Вы не на линии' }
})
</script>

<template>
  <section
    ref="boundsEl"
    class="tg-safe-x pointer-events-none absolute inset-x-0 bottom-[calc(var(--app-safe-area-bottom)+5.75rem)] z-20 h-[70vh] flex items-end"
  >
    <div
      ref="sheetEl"
      class="pointer-events-auto mx-auto max-w-sm w-full flex flex-col overflow-hidden rounded-[2rem] bg-secondary-950/82 shadow-[0_-18px_54px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
      :style="sheetStyle"
    >
      <!-- Грабер: drag/тап для сворачивания и возврата -->
      <div
        ref="handleEl"
        aria-label="Потяните, чтобы развернуть или свернуть панель"
        class="shrink-0 cursor-grab touch-none select-none px-4 pb-3 pt-3 active:cursor-grabbing"
        role="button"
        tabindex="0"
        @keydown="onHandleKeydown"
      >
        <div class="mx-auto h-1.5 w-12 rounded-full bg-white/25" />
      </div>

      <div class="relative min-h-0 flex-1">
        <!-- Обычно контент влезает целиком (half подгоняется под него);
             auto — страховка для маленьких экранов. Скроллбар скрыт. -->
        <div class="[scrollbar-width:none] h-full overflow-y-auto px-4 pb-4 [&::-webkit-scrollbar]:hidden">
          <div ref="contentEl" :class="{ invisible: isPeekPillVisible }">
            <!-- Шапка статуса: этап поездки / на линии / не на линии -->
            <div class="flex items-center gap-3">
              <div
                class="relative h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl"
                :class="statusMeta.iconClass"
              >
                <span :class="statusMeta.icon" class="text-6.5" />
                <span v-if="statusMeta.pulse" class="absolute right-1 top-1 h-2 w-2" aria-hidden="true">
                  <span class="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                  <span class="absolute inset-0 rounded-full bg-emerald-400" />
                </span>
              </div>

              <div class="min-w-0 flex-1">
                <h2 class="truncate text-lg font-950">
                  {{ statusMeta.title }}
                </h2>
                <p class="mt-0.5 truncate text-sm text-slate-400">
                  {{ statusMeta.subtitle }}
                </p>
              </div>
            </div>

            <!-- Связь с сервером заказов деградировала — заказы могут не доходить -->
            <div v-if="connectionHint" class="mt-3 flex items-center gap-2.5 rounded-2xl bg-amber-500/12 px-3.5 py-2.5">
              <span class="i-mdi-wifi-alert shrink-0 text-4.5 text-amber-300" aria-hidden="true" />
              <p class="text-xs text-amber-200 font-800 leading-4">
                {{ connectionHint }}
              </p>
            </div>

            <!-- Тарифы, по которым водитель принимает заказы -->
            <div v-if="!driver.hasActiveTrip && driver.availableCategories.length" class="mt-4">
              <p class="mb-2 text-xs text-slate-400 font-800 uppercase">
                Тарифы на линии
              </p>

              <div class="flex flex-wrap gap-2">
                <template v-if="driver.isOnline">
                  <span
                    v-for="cat in driver.activeCategories"
                    :key="cat"
                    class="rounded-full bg-main-500/18 px-3 py-1.5 text-xs text-main-200 font-800"
                  >
                    {{ categoryLabel(cat) }}
                  </span>
                </template>

                <template v-else>
                  <button
                    v-for="cat in driver.availableCategories"
                    :key="cat"
                    :disabled="driver.isSavingCategories"
                    class="rounded-full px-3 py-1.5 text-xs font-800 transition active:scale-[0.96] disabled:opacity-60"
                    :class="driver.activeCategories.includes(cat) ? 'bg-main-500 text-white' : 'bg-white/8 text-slate-400'"
                    type="button"
                    @click="driver.toggleCategory(cat)"
                  >
                    {{ categoryLabel(cat) }}
                  </button>
                </template>
              </div>

              <p v-if="blockedByNoCategory" class="mt-2 text-xs text-amber-300 font-700">
                Выберите хотя бы один тариф
              </p>
            </div>

            <div v-if="driver.hasActiveTrip && tripStep" class="mt-4 space-y-2">
              <!-- Платное ожидание: таймер после отметки «Я на месте» -->
              <div
                v-if="waitingInfo"
                class="rounded-2xl px-4 py-2.5"
                :class="waitingInfo.accent ? 'bg-amber-500/12' : 'bg-white/7'"
              >
                <p class="text-xs font-800 leading-5" :class="waitingInfo.accent ? 'text-amber-200' : 'text-slate-300'">
                  <span class="i-mdi-timer-sand mr-1 inline-block align-middle text-4" />
                  {{ waitingInfo.text }}
                </p>
              </div>

              <button
                class="h-14 w-full flex items-center justify-center gap-2 rounded-2xl bg-main-500 text-sm font-950 shadow-[0_12px_30px_rgba(230,173,46,0.28)] transition active:scale-[0.99]"
                type="button"
                @click="emit('primaryAction')"
              >
                <span :class="tripStep.icon" class="text-6" />
                {{ tripStep.action }}
              </button>

              <RouterLink
                class="relative h-12 w-full flex items-center justify-center gap-2 rounded-2xl bg-white/8 text-sm text-white font-900 transition active:scale-[0.99]"
                to="/trip-chat"
              >
                <span class="i-mdi-message-text text-5" />
                Чат с пассажиром
                <span
                  v-if="tripChat.unreadCount"
                  class="absolute right-3 min-w-5 flex items-center justify-center rounded-full bg-main-500 px-1.5 py-0.5 text-[11px] text-white font-900"
                >
                  {{ tripChat.unreadCount }}
                </span>
              </RouterLink>

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
              :disabled="driver.isChangingStatus || driver.isRestoringActiveTrip || (!driver.isOnline && !isLocationGranted) || blockedByNoCategory"
              class="mt-4 h-14 w-full flex items-center justify-center gap-2 rounded-2xl text-base font-900 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              :class="driver.isOnline ? 'bg-red-500/12 text-red-300' : 'bg-main-500 text-white shadow-[0_12px_30px_rgba(230,173,46,0.28)]'"
              type="button"
              @click="emit('toggleOnline')"
            >
              <span v-if="!driver.isOnline && !driver.isChangingStatus && !driver.isRestoringActiveTrip" class="i-mdi-steering text-6" aria-hidden="true" />
              {{ driver.isRestoringActiveTrip ? 'Восстанавливаем...' : driver.isChangingStatus ? 'Обновляем...' : driver.isOnline ? 'Уйти с линии' : 'Выйти на линию' }}
            </button>

            <!-- Причина отказа в выходе на линию (403 с бэка) -->
            <div v-if="onlineBlockMessage && !driver.isOnline" class="mt-3 rounded-2xl bg-amber-500/12 px-4 py-3">
              <p class="text-sm text-amber-200 font-800">
                {{ onlineBlockMessage }}
              </p>
              <RouterLink
                class="mt-2.5 h-10 flex items-center justify-center rounded-xl bg-amber-400 text-sm text-#06142f font-900 transition active:scale-[0.98]"
                :to="onlineBlockLink.to"
              >
                {{ onlineBlockLink.label }}
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
        </div>

        <!-- Свёрнутая шторка: пилюля-сводка (статус/этап поездки), тап раскрывает -->
        <button
          v-show="isPeekPillVisible"
          class="absolute inset-0 flex items-center justify-between gap-3 px-5 text-left transition active:scale-[0.99]"
          type="button"
          @click="snapTo('half')"
        >
          <span class="min-w-0 flex items-center gap-3">
            <span v-if="peekPill.pulse" class="relative h-2.5 w-2.5 shrink-0" aria-hidden="true">
              <span class="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
              <span class="absolute inset-0 rounded-full bg-emerald-400" />
            </span>
            <span v-else :class="peekPill.icon" class="shrink-0 text-5.5 text-main-300" aria-hidden="true" />
            <span class="min-w-0">
              <span class="block truncate text-base font-950 leading-tight">{{ peekPill.title }}</span>
              <span v-if="peekPill.subtitle" class="block truncate text-xs text-white/45 font-800">
                {{ peekPill.subtitle }}
              </span>
            </span>
          </span>
          <span class="i-mdi-chevron-up shrink-0 text-6 text-white/40" aria-hidden="true" />
        </button>
      </div>
    </div>
  </section>
</template>
