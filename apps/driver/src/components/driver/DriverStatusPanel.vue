<script setup lang="ts">
import type { UserCoordinates } from '@edtaxi/shared/composables/mapbox/useUserLocation'
import type { OnlineBlockTarget } from '~/utils/onlineBlock'
import { openExternalLink, openTelegramChat } from '@edtaxi/shared/composables/auth/telegram'
import { useBottomSheet } from '@edtaxi/shared/composables/useBottomSheet'
import { TG_BOT_USERNAME } from '~/constants/telegram'
import { useDriverStore } from '~/stores/driver'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'
import { useTripChatStore } from '~/stores/tripChat'
import { tripOptionBadges } from '~/utils/tripOptions'
import { categoryLabel } from '~/utils/vehicleCategories'

const props = defineProps<{
  trackingStatus: 'closed' | 'connecting' | 'open'
  onlineBlockMessage: string
  // Куда вести водителя из баннера-блокировки. Явный признак, а не разбор
  // текста ошибки: любая переформулировка сообщения ломала бы маршрутизацию.
  onlineBlockTarget: OnlineBlockTarget
  showRouteLoading: boolean
  isLocationGranted: boolean
  // Своя геопозиция — для подсказки «подъедьте ближе» на кнопке этапа.
  driverCoordinates?: null | UserCoordinates
}>()
const emit = defineEmits<{ primaryAction: [], toggleOnline: [] }>()
const { locale, t } = useI18n()

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

// Разные причины блокировки решаются на разных экранах: парк выбирают в списке
// парков, просроченный фотоконтроль проходят заново на его собственном экране.
// Трансляция геопозиции — единственная причина, которая закрывается не на
// экране апы, а в чате с ботом: у неё вместо маршрута кнопка выхода в Telegram.
const ONLINE_BLOCK_LINKS: Record<OnlineBlockTarget, { labelKey: string, to?: string }> = {
  'daily-check': { labelKey: 'driverStatus.dailyCheck', to: '/menu/profile/onboarding/daily-check' },
  'debt': { labelKey: 'driverStatus.topUp', to: '/earnings' },
  'live-location': { labelKey: 'driverStatus.openBotChat' },
  'park': { labelKey: 'driverStatus.choosePark', to: '/menu/parks' },
  'verification': { labelKey: 'driverStatus.verification', to: '/menu/profile/onboarding' },
}

const onlineBlockLink = computed(() => ONLINE_BLOCK_LINKS[props.onlineBlockTarget])

const driver = useDriverStore()

// Навигатор (TODO п.1а): только https-ссылки — кастомные схемы (dgis://,
// yandexnavi://) из TG-вебвью открываются ненадёжно, а https перехватит
// установленное приложение само. Цель — текущая непройденная точка маршрута
// (А → остановки → Б, driver.currentNavPoint). НЕ копировать map.vue
// fitBounds-логику — она про другое.
const isNavSheetOpen = ref(false)

const navTarget = computed(() => driver.currentNavPoint)

const navApps = computed(() => {
  const target = navTarget.value
  if (!target)
    return []
  return [
    { icon: 'i-mdi-map-search', label: '2ГИС', url: `https://2gis.kz/routeSearch/to/${target.lng},${target.lat}` },
    { icon: 'i-mdi-navigation-variant', label: 'Яндекс Карты', url: `https://yandex.kz/maps/?rtext=~${target.lat},${target.lng}&rtt=auto` },
    { icon: 'i-mdi-google-maps', label: 'Google Maps', url: `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}` },
  ]
})

function openNavigator(url: string) {
  isNavSheetOpen.value = false
  openExternalLink(url)
}
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
      ? t('driverStatus.waitPaid', { fee: fee.toLocaleString(locale.value), time: `${mm}:${ss}` })
      : t('driverStatus.waitFree', { fee: perMinute, free: freeMinutes, time: `${mm}:${ss}` }),
  }
})

// Имена выбранных районов для read-only пилюль в онлайне.
const activeDistricts = computed(() =>
  driver.availableDistricts.filter(district => driver.activeDistrictIds.includes(district.id)),
)

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
      action: t('driverStatus.arrivedAction'),
      description: t('driverStatus.toPickupText'),
      icon: 'i-mdi-map-marker-check',
      title: t('driverStatus.toPickup'),
    }
  }

  if (driver.activeTripStep === 'arrived') {
    return {
      action: t('driverStatus.startAction'),
      description: t('driverStatus.arrivedText'),
      icon: 'i-mdi-play-circle',
      title: t('driverStatus.waitingPickup'),
    }
  }

  return {
    action: t('driverStatus.completeAction'),
    description: t('driverStatus.inProgressText'),
    icon: 'i-mdi-flag-checkered',
    title: t('driverStatus.inProgress'),
  }
})

// --- Гео-проверка кнопки этапа ---
//
// «Я на месте» включает пассажиру платное ожидание, «Завершить» закрывает
// поездку — сервер проверяет, что водитель действительно у точки, и отвечает
// 409, если нет. Здесь та же проверка на клиенте: не чтобы защитить (источник
// истины — сервер), а чтобы водитель не жал кнопку впустую и видел, сколько
// осталось доехать.
//
// Режим и радиусы приходят с сервера (профиль): в warn сервер пропускает
// действие, поэтому и кнопку НЕ блокируем — иначе клиент запрещал бы то, что
// бэкенд разрешает.
function distanceMeters(from: { lat: number, lng: number }, to: { lat: number, lng: number }) {
  const toRad = Math.PI / 180
  const dLat = (to.lat - from.lat) * toRad
  const dLng = (to.lng - from.lng) * toRad
  const meanLat = ((from.lat + to.lat) / 2) * toRad
  const earthRadiusM = 6_371_000
  return Math.hypot(dLat, dLng * Math.cos(meanLat)) * earthRadiusM
}

const geoGateCheck = computed(() => {
  const gate = driver.geoGate
  const trip = driver.activeTrip
  const here = props.driverCoordinates
  const step = driver.activeTripStep

  // Проверяем только два действия; «Начать поездку» не гейтится — пассажир
  // уже в машине, и водитель мог отъехать от точки подачи.
  const target = step === 'to_pickup'
    ? { lat: trip?.pickup_lat, lng: trip?.pickup_lng, radius: gate?.arrival_radius_m }
    : step === 'in_progress'
      ? { lat: trip?.dropoff_lat, lng: trip?.dropoff_lng, radius: gate?.completion_radius_m }
      : null

  if (gate?.mode !== 'enforce' || !here || !target?.radius
    || typeof target.lat !== 'number' || typeof target.lng !== 'number') {
    return null
  }

  const distance = distanceMeters(here, { lat: target.lat, lng: target.lng })
  if (distance <= target.radius)
    return null

  return { distance: Math.round(distance) }
})

const isPrimaryActionBlocked = computed(() => Boolean(geoGateCheck.value))

const geoGateHint = computed(() => {
  const check = geoGateCheck.value
  if (!check)
    return ''

  const distance = check.distance >= 1000
    ? t('driverStatus.km', { n: (check.distance / 1000).toLocaleString(locale.value, { maximumFractionDigits: 1 }) })
    : t('driverStatus.m', { n: check.distance })
  return t('driverStatus.moveCloser', { distance })
})

// Шапка панели: одно человеческое состояние вместо тех-карточек
// («Доступность» / «WebSocket»): этап поездки, «на линии», «не на линии».
const statusMeta = computed(() => {
  if (tripStep.value) {
    return {
      icon: tripStep.value.icon,
      iconClass: 'bg-main-500/16 text-main-200 light:text-main-700',
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
      subtitle: t('driverStatus.waitingOrder'),
      title: t('driverStatus.online'),
    }
  }

  return {
    icon: 'i-mdi-steering',
    iconClass: 'bg-white/7 text-slate-300 light:text-slate-600',
    pulse: false,
    subtitle: t('driverStatus.offlineText'),
    title: t('driverStatus.offline'),
  }
})

// Маршрут активного заказа: адреса А/остановки/Б, бейджи опций и комментарий
// пассажира — раньше в панели их не было вовсе.
const tripStops = computed(() => driver.activeTrip?.stops ?? [])
const tripBadges = computed(() => tripOptionBadges(driver.activeTrip?.options))

// Статус сокета наружу не показываем — только человеческое предупреждение,
// когда связь на линии реально деградировала и заказы могут не доходить.
const connectionHint = computed(() => {
  if (!driver.isOnline || props.trackingStatus === 'open')
    return ''
  return props.trackingStatus === 'connecting'
    ? t('driverStatus.connecting')
    : t('driverStatus.reconnecting')
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
    return { icon: '', pulse: true, subtitle: t('driverStatus.waitingOrder'), title: t('driverStatus.online') }

  return { icon: 'i-mdi-steering', pulse: false, subtitle: t('driverStatus.tariffsAndOnline'), title: t('driverStatus.offline') }
})
</script>

<template>
  <section
    ref="boundsEl"
    class="tg-safe-x pointer-events-none absolute inset-x-0 bottom-[calc(var(--app-safe-area-bottom)+5.75rem)] z-20 h-[70vh] flex items-end"
  >
    <div
      ref="sheetEl"
      class="pointer-events-auto mx-auto max-w-sm w-full flex flex-col overflow-hidden rounded-[2rem] app-sheet shadow-[0_-18px_54px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
      :style="sheetStyle"
    >
      <!-- Грабер: drag/тап для сворачивания и возврата -->
      <div
        ref="handleEl"
        :aria-label="t('driverStatus.dragHandle')"
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
                <p class="mt-0.5 truncate text-sm app-muted">
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

            <!-- Пассажир отменил назначенный заказ: водитель не виноват, бэкенд
                 уже ищет ему следующий заказ рядом (автоперекидка). -->
            <div
              v-if="driver.passengerCancelledBanner && driver.isOnline && !driver.hasActiveTrip"
              class="mt-3 flex items-center gap-2.5 rounded-2xl bg-amber-500/12 px-3.5 py-2.5"
            >
              <span class="i-mdi-account-cancel shrink-0 text-4.5 text-amber-300" aria-hidden="true" />
              <p class="flex-1 text-xs text-amber-200 font-800 leading-4">
                {{ t('driverStatus.passengerCancelled') }}
              </p>
              <button
                :aria-label="t('driverStatus.hide')"
                class="shrink-0 text-amber-300/70 transition active:scale-95"
                type="button"
                @click="driver.dismissCancelledBanner"
              >
                <span class="i-mdi-close text-4.5" aria-hidden="true" />
              </button>
            </div>

            <!-- Тарифы, по которым водитель принимает заказы -->
            <div v-if="!driver.hasActiveTrip && driver.availableCategories.length" class="mt-4">
              <p class="mb-2 text-xs app-muted font-800 uppercase">
                {{ t('driverStatus.tariffsOnLine') }}
              </p>

              <div class="flex flex-wrap gap-2">
                <template v-if="driver.isOnline">
                  <span
                    v-for="cat in driver.activeCategories"
                    :key="cat"
                    class="rounded-full bg-main-500/18 px-3 py-1.5 text-xs text-main-200 font-800 light:text-main-700"
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
                    :class="driver.activeCategories.includes(cat) ? 'bg-main-500 text-white' : 'app-chip app-muted'"
                    type="button"
                    @click="driver.toggleCategory(cat)"
                  >
                    {{ categoryLabel(cat) }}
                  </button>
                </template>
              </div>

              <p v-if="blockedByNoCategory" class="mt-2 text-xs text-amber-300 font-700">
                {{ t('driverStatus.pickTariff') }}
              </p>
            </div>

            <!-- Районы приёма заказов (TODO п.6): read-only сводка, редактирование
                 переехало в Настройки (там карта-превью с подсветкой). -->
            <RouterLink
              v-if="!driver.hasActiveTrip && driver.availableDistricts.length"
              class="mt-4 flex items-center gap-3 rounded-2xl app-card px-4 py-3 transition active:scale-[0.99]"
              to="/menu/settings"
            >
              <span class="i-mdi-map-marker-radius-outline shrink-0 text-5 app-accent" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <span class="block text-xs app-muted font-800 uppercase">{{ t('driverStatus.orderDistricts') }}</span>
                <span class="mt-0.5 block truncate text-sm font-800">
                  {{ activeDistricts.length ? activeDistricts.map(d => d.name).join(', ') : t('driverStatus.wholeCity') }}
                </span>
              </span>
              <span class="i-mdi-chevron-right shrink-0 text-5 app-faint" aria-hidden="true" />
            </RouterLink>

            <div v-if="driver.hasActiveTrip && tripStep" class="mt-4 space-y-2">
              <!-- Маршрут заказа: А / остановки / Б + опции + комментарий -->
              <div v-if="driver.activeTrip" class="rounded-2xl app-card px-4 py-3">
                <p class="flex items-center gap-2 text-[13px] font-800">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
                  <span class="truncate">{{ driver.activeTrip.pickup_address }}</span>
                </p>
                <p
                  v-for="(stop, index) in tripStops"
                  :key="`panel-stop-${index}`"
                  class="mt-1.5 flex items-center gap-2 text-[13px] font-800"
                  :class="index < driver.passedStopCount ? 'app-faint line-through' : 'text-white/80'"
                >
                  <span
                    class="h-4 w-4 flex shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-[9px] text-amber-300 font-950"
                    aria-hidden="true"
                  >
                    {{ index + 1 }}
                  </span>
                  <span class="truncate">{{ stop.address }}</span>
                </p>
                <p class="mt-1.5 flex items-center gap-2 text-[13px] font-800">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
                  <span class="truncate">{{ driver.activeTrip.dropoff_address }}</span>
                </p>

                <div v-if="tripBadges.length" class="mt-2.5 flex flex-wrap gap-1.5">
                  <span
                    v-for="badge in tripBadges"
                    :key="badge.labelKey"
                    class="inline-flex items-center gap-1 rounded-full bg-main-500/14 px-2 py-0.5 text-[11px] text-main-200 font-800 light:text-main-700"
                  >
                    <span :class="badge.icon" class="text-3.5" aria-hidden="true" />
                    {{ t(badge.labelKey, badge.params ?? {}) }}
                  </span>
                </div>

                <p
                  v-if="driver.activeTrip.comment"
                  class="mt-2.5 flex items-start gap-1.5 border-t border-white/8 pt-2.5 text-xs text-slate-300 leading-4 light:text-slate-600"
                >
                  <span class="i-mdi-message-text-outline mt-0.5 shrink-0 text-3.5 app-accent" aria-hidden="true" />
                  {{ driver.activeTrip.comment }}
                </p>
              </div>

              <!-- Платное ожидание: таймер после отметки «Я на месте» -->
              <div
                v-if="waitingInfo"
                class="rounded-2xl px-4 py-2.5"
                :class="waitingInfo.accent ? 'bg-amber-500/12' : 'bg-white/7'"
              >
                <p class="text-xs font-800 leading-5" :class="waitingInfo.accent ? 'text-amber-200' : 'text-slate-300 light:text-slate-600'">
                  <span class="i-mdi-timer-sand mr-1 inline-block align-middle text-4" />
                  {{ waitingInfo.text }}
                </p>
              </div>

              <button
                :disabled="isPrimaryActionBlocked"
                class="h-14 w-full flex items-center justify-center gap-2 rounded-2xl bg-main-500 text-sm font-950 shadow-[0_12px_30px_rgba(230,173,46,0.28)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                type="button"
                @click="emit('primaryAction')"
              >
                <span :class="tripStep.icon" class="text-6" />
                {{ tripStep.action }}
              </button>

              <!-- Почему кнопка недоступна: без этой строки водитель видел бы
                   просто серую кнопку и не понимал, что делать. -->
              <p v-if="geoGateHint" class="text-center text-xs text-amber-200 font-800 leading-4">
                <span class="i-mdi-map-marker-distance mr-1 inline-block align-middle text-4" />
                {{ geoGateHint }}
              </p>

              <!-- Остановка пройдена: навигатор переключается на следующую точку -->
              <button
                v-if="driver.canAdvanceNavPoint"
                class="h-12 w-full flex items-center justify-center gap-2 rounded-2xl app-chip text-sm text-white font-900 transition active:scale-[0.99]"
                type="button"
                @click="driver.advanceNavPoint()"
              >
                <span class="i-mdi-map-marker-check-outline text-5" />
                {{ t('driverStatus.stopPassed') }}
              </button>

              <!-- Навигатор к текущей точке маршрута во внешнем приложении -->
              <button
                v-if="navTarget"
                class="h-12 w-full flex items-center justify-center gap-2 rounded-2xl app-chip text-sm text-white font-900 transition active:scale-[0.99]"
                type="button"
                @click="isNavSheetOpen = !isNavSheetOpen"
              >
                <span class="i-mdi-navigation text-5" />
                {{ driver.activeTripStep === 'to_pickup' ? t('driverStatus.navToPassenger') : t('driverStatus.navTo', { label: navTarget?.label }) }}
              </button>
              <div v-if="isNavSheetOpen && navApps.length" class="space-y-2">
                <!-- Точки маршрута: текущая цель подсвечена, пройденные — приглушены -->
                <div v-if="driver.tripNavPoints.length > 2" class="rounded-2xl app-card p-2 space-y-1">
                  <p
                    v-for="point in driver.tripNavPoints"
                    :key="`${point.kind}-${point.label}`"
                    class="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-800"
                    :class="point.state === 'current'
                      ? 'bg-main-500/16 text-main-100 light:text-main-700'
                      : point.state === 'passed' ? 'app-faint line-through' : 'text-slate-300 light:text-slate-600'"
                  >
                    <span class="shrink-0 text-[11px] font-950 opacity-70">{{ point.label }}</span>
                    <span class="truncate">{{ point.address }}</span>
                  </p>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="app in navApps"
                    :key="app.label"
                    class="h-14 flex flex-col items-center justify-center gap-1 rounded-2xl app-card text-[11px] text-slate-300 font-800 transition active:scale-[0.97] light:text-slate-600"
                    type="button"
                    @click="openNavigator(app.url)"
                  >
                    <span :class="app.icon" class="text-5 app-accent" aria-hidden="true" />
                    {{ app.label }}
                  </button>
                </div>
              </div>

              <RouterLink
                class="relative h-12 w-full flex items-center justify-center gap-2 rounded-2xl app-chip text-sm text-white font-900 transition active:scale-[0.99]"
                to="/trip-chat"
              >
                <span class="i-mdi-message-text text-5" />
                {{ t('driverStatus.chatWithPassenger') }}
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
                {{ t('driverStatus.cancelOrder') }}
              </button>
            </div>

            <!-- v-else-if, а не голый v-else: блок выше висит на
                 (hasActiveTrip && tripStep), и при активной поездке без шага
                 (неизвестный статус, момент восстановления) сюда проваливалась
                 кнопка линии прямо посреди заказа. Тап по ней сбрасывал признак
                 занятости, и водителю прилетал оффер в пути. -->
            <button
              v-else-if="!driver.hasActiveTrip"
              :disabled="driver.isChangingStatus || driver.isRestoringActiveTrip || (!driver.isOnline && !isLocationGranted) || blockedByNoCategory"
              class="mt-4 h-14 w-full flex items-center justify-center gap-2 rounded-2xl text-base font-900 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              :class="driver.isOnline ? 'bg-red-500/12 text-red-300' : 'bg-main-500 text-white shadow-[0_12px_30px_rgba(230,173,46,0.28)]'"
              type="button"
              @click="emit('toggleOnline')"
            >
              <span v-if="!driver.isOnline && !driver.isChangingStatus && !driver.isRestoringActiveTrip" class="i-mdi-steering text-6" aria-hidden="true" />
              {{ driver.isRestoringActiveTrip ? t('driverStatus.restoring') : driver.isChangingStatus ? t('driverStatus.updating') : driver.isOnline ? t('driverStatus.goOffline') : t('driverStatus.goOnline') }}
            </button>

            <!-- Пока трансляция жива, водитель виден диспетчеру даже со
                 свёрнутым приложением. Показываем, когда она погаснет: за 20
                 минут до этого бот пришлёт напоминание, но лучше видеть срок
                 заранее, чем узнать о нём в конце смены. -->
            <p
              v-if="driver.isOnline && driver.liveLocationUntilLabel"
              class="mt-3 flex items-center justify-center gap-1.5 text-xs app-muted font-800"
            >
              <span class="i-mdi-broadcast text-4 text-emerald-400" aria-hidden="true" />
              {{ t('driverStatus.reserveGeoUntil', { time: driver.liveLocationUntilLabel }) }}
            </p>

            <!-- Причина отказа в выходе на линию (403 с бэка) -->
            <div v-if="onlineBlockMessage && !driver.isOnline" class="mt-3 rounded-2xl bg-amber-500/12 px-4 py-3">
              <p class="text-sm text-amber-200 font-800">
                {{ onlineBlockMessage }}
              </p>
              <p v-if="onlineBlockTarget === 'live-location'" class="mt-1.5 text-xs text-amber-200/80 font-700">
                {{ t('driverStatus.liveLocationHint') }}
              </p>
              <RouterLink
                v-if="onlineBlockLink.to"
                class="mt-2.5 h-10 flex items-center justify-center rounded-xl bg-amber-400 text-sm text-#06142f font-900 transition active:scale-[0.98]"
                :to="onlineBlockLink.to"
              >
                {{ t(onlineBlockLink.labelKey) }}
              </RouterLink>
              <button
                v-else
                class="mt-2.5 h-10 w-full flex items-center justify-center rounded-xl bg-amber-400 text-sm text-#06142f font-900 transition active:scale-[0.98]"
                type="button"
                @click="openTelegramChat(TG_BOT_USERNAME)"
              >
                {{ t(onlineBlockLink.labelKey) }}
              </button>
            </div>

            <RouterLink
              v-if="!onboarding.hasVehicle"
              class="mt-3 h-12 flex items-center justify-center rounded-2xl app-chip text-sm text-main-100 font-900 light:text-main-700"
              to="/menu/vehicle"
            >
              {{ t('driverStatus.addVehicle') }}
            </RouterLink>

            <p v-if="showRouteLoading" class="mt-3 text-center text-xs app-muted font-800">
              {{ t('driverStatus.buildingRoute') }}
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
            <span v-else :class="peekPill.icon" class="shrink-0 text-5.5 app-accent" aria-hidden="true" />
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
