<script setup lang="ts">
import type { EstimateTripResponse, Trip, VehicleCategory } from '~/types/trips'
import { ApiError, mediaUrl } from '~/api/client'
import { showErrorToast } from '~/api/errors'
import { shareTripLink } from '~/api/share'
import { sendTripTip } from '~/api/trips'
import { useToast } from '~/composables/useToast'
import { tagsForScore } from '~/constants/ratingTags'
import { formatFare, TARIFF_META } from '~/constants/tariffs'
import { usePlacesStore } from '~/stores/places'
import { useTripChatStore } from '~/stores/tripChat'
import { MAX_TRIP_STOPS, useTripsStore } from '~/stores/trips'
import { coarseEtaSeconds } from '~/utils/eta'

const props = defineProps<{
  activeTrip: null | Trip
  destination: string
  elapsedSeconds: number
  pickup: string
  selectedCategories: VehicleCategory[]
  selectedEstimate: EstimateTripResponse | null
}>()

// Пока водитель не найден — крутим «радар» и тикающий таймер поиска.
const isSearchingStatus = computed(() => !props.activeTrip || props.activeTrip.status === 'searching')

const trips = useTripsStore()

// ETA: приоритет — живой eta_sec из WebSocket (бэк считает по скорости
// водителя); до первого пинга — грубая оценка от последней известной позиции
// машины из пейлоада поездки. Цель зависит от этапа: до посадки — точка А,
// в пути — точка Б.
const etaSecondsValue = computed(() => {
  const trip = props.activeTrip
  if (!trip)
    return null

  const status = trip.status
  if (status !== 'driver_assigned' && status !== 'in_progress')
    return null

  const live = trips.driverLocation
  if (live?.eta_sec != null && live.eta_sec > 0)
    return live.eta_sec

  const location = live ?? trip.driver?.location
  if (!location)
    return null

  const target = status === 'in_progress'
    ? { lat: trip.dropoff_lat, lng: trip.dropoff_lng }
    : { lat: trip.pickup_lat, lng: trip.pickup_lng }

  return coarseEtaSeconds(location.lat, location.lng, target.lat, target.lng)
})

const etaMinutes = computed(() => {
  if (etaSecondsValue.value == null)
    return null
  return Math.max(1, Math.round(etaSecondsValue.value / 60))
})

const etaChip = computed(() => {
  if (etaMinutes.value == null)
    return null
  if (props.activeTrip?.status === 'driver_assigned')
    return `Водитель приедет через ~${etaMinutes.value} мин`
  if (props.activeTrip?.status === 'in_progress')
    return `Прибытие через ~${etaMinutes.value} мин`
  return null
})

const elapsedLabel = computed(() => {
  const mm = Math.floor(props.elapsedSeconds / 60)
  const ss = String(props.elapsedSeconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
})

const router = useRouter()
const places = usePlacesStore()
const tripChat = useTripChatStore()
const isFavoriteSaved = ref(false)

const isCompleted = computed(() => props.activeTrip?.status === 'completed')

// Чат доступен, пока поездка активна (водитель назначен и до завершения).
const isChatAvailable = computed(() => {
  const status = props.activeTrip?.status
  return status === 'driver_assigned' || status === 'driver_arriving' || status === 'in_progress'
})
const isDriverArrived = computed(() => props.activeTrip?.status === 'driver_arriving')

// --- Остановка по пути ---

const pendingRouteChange = computed(() => trips.pendingRouteChange)

// formatFare из constants/tariffs принимает оценку целиком; здесь у нас голая
// сумма доплаты, поэтому форматируем её отдельно тем же способом.
function formatTenge(value: number) {
  return `${Math.round(value).toLocaleString('ru-RU')} ₸`
}

// Предлагать остановку можно в том же окне, что и писать в чат: водитель уже
// назначен, поездка ещё не закрыта. Ровно этот же коридор проверяет бэкенд.
const canProposeStop = computed(() => {
  if (!isChatAvailable.value || pendingRouteChange.value)
    return false

  return (props.activeTrip?.stops?.length ?? 0) < MAX_TRIP_STOPS
})

function startStopPicker() {
  // Даунбар прячется сам, пока пикер активен, — карта остаётся целиком под пальцем.
  trips.startMapPicker('trip-stop')
}

function cancelStopRequest() {
  trips.cancelPendingRouteChange().catch(() => {})
}

function openChat() {
  router.push('/trip-chat')
}

// «Уже выхожу» — быстрый ответ водителю с табло: сообщение уходит в чат
// поездки, и мы открываем сам чат.
const isSendingOnMyWay = ref(false)
async function sendOnMyWay() {
  const trip = props.activeTrip
  if (!trip || isSendingOnMyWay.value)
    return
  isSendingOnMyWay.value = true
  try {
    await tripChat.sendQuickMessage(trip.id, 'Уже выхожу 🚶')
  }
  catch {}
  finally {
    isSendingOnMyWay.value = false
  }
  await router.push('/trip-chat')
}

// Платное ожидание: тикающий таймер от arrived_at. Правила (бесплатные минуты
// и цена минуты) приходят с бэка в объекте поездки.
const nowTick = ref(Date.now())
let waitTimer: number | undefined
watch(isDriverArrived, (arrived) => {
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
  const trip = props.activeTrip
  if (!trip || !isDriverArrived.value || !trip.arrived_at)
    return null

  const freeMinutes = trip.waiting_free_minutes ?? 3
  const perMinute = trip.waiting_per_minute_fee ?? 100
  const waitedSec = Math.max(0, Math.floor((nowTick.value - new Date(trip.arrived_at).getTime()) / 1000))
  const freeLeftSec = freeMinutes * 60 - waitedSec

  if (freeLeftSec > 0) {
    const mm = Math.floor(freeLeftSec / 60)
    const ss = String(freeLeftSec % 60).padStart(2, '0')
    return {
      accent: false,
      text: `Бесплатное ожидание: ещё ${mm}:${ss}. Дальше +${perMinute} ₸ за минуту.`,
    }
  }

  const paidMinutes = Math.floor(-freeLeftSec / 60)
  const fee = paidMinutes * perMinute
  return {
    accent: true,
    text: fee > 0
      ? `Платное ожидание: +${fee.toLocaleString('ru-RU')} ₸ (${paidMinutes} мин по ${perMinute} ₸).`
      : `Бесплатные ${freeMinutes} мин истекли — дальше +${perMinute} ₸ за минуту.`,
  }
})

// Уже ли это место среди избранных (по близким координатам) — чтобы не
// предлагать сохранить то, что уже сохранено.
const isAlreadyFavorite = computed(() => {
  const trip = props.activeTrip
  if (!trip)
    return false
  return places.places.some(p =>
    Math.abs(p.lat - trip.dropoff_lat) < 1e-4 && Math.abs(p.lng - trip.dropoff_lng) < 1e-4,
  )
})

async function toggleSaveFavorite(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const trip = props.activeTrip
  if (!checked || !trip || places.isMutating || isFavoriteSaved.value)
    return

  const name = trip.dropoff_address.split(',')[0]?.trim() || 'Избранное место'

  try {
    await places.add({
      name,
      address: trip.dropoff_address,
      lat: trip.dropoff_lat,
      lng: trip.dropoff_lng,
    })
    isFavoriteSaved.value = true
  }
  catch {}
}

// ===== Итог завершённой поездки: время пути, стоимость, оценка водителя =====

const toast = useToast()

function formatClock(value: null | string | undefined) {
  if (!value)
    return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()))
    return null
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date)
}

// Фактическое время пути: completed_at - started_at (после refresh поездки
// оба таймстампа приходят с бэка). До прихода completed_at — не показываем.
const tripDurationText = computed(() => {
  const trip = props.activeTrip
  if (!trip?.started_at || !trip.completed_at)
    return null

  const ms = new Date(trip.completed_at).getTime() - new Date(trip.started_at).getTime()
  if (!Number.isFinite(ms) || ms <= 0)
    return null

  const totalMinutes = Math.max(1, Math.round(ms / 60000))
  if (totalMinutes < 60)
    return `${totalMinutes} мин`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`
})

const completedAtText = computed(() => formatClock(props.activeTrip?.completed_at))

const finalFareText = computed(() => {
  const trip = props.activeTrip
  if (!trip)
    return null
  const fare = trip.final_fare ?? trip.estimated_fare
  return `${Math.round(fare).toLocaleString('ru-RU')} ₸`
})

// Оценка: если поездка уже оценена (my_rating с бэка или только что отправили),
// показываем звёзды в режиме «спасибо»; иначе — форму с 5 звёздами и комментарием.
const ratingScore = ref(5)
const ratingComment = ref('')
const ratingTags = ref<string[]>([])
const ratedScore = computed(() => props.activeTrip?.my_rating?.score ?? null)

// Чипы под звёздами: 4-5 — хорошие, 1-3 — плохие; смена оценки сбрасывает выбор.
const visibleRatingTags = computed(() => tagsForScore(ratingScore.value))
watch(ratingScore, () => {
  ratingTags.value = []
})

function toggleRatingTag(value: string) {
  ratingTags.value = ratingTags.value.includes(value)
    ? ratingTags.value.filter(tag => tag !== value)
    : [...ratingTags.value, value]
}

// Чаевые водителю (100/200 ₸ или своя сумма). После сетевой ошибки кнопки НЕ
// блокируем: если карта списалась с опозданием (late-success вебхука), деньги
// упадут на кошелёк, и повторный тап пройдёт уже wallet-путём.
const tipSent = ref(false)
const tipPending = ref(false)
const customTipVisible = ref(false)
const customTipAmount = ref<null | number>(null)

// Новая поездка на экране — чистая форма оценки.
watch(() => props.activeTrip?.id, () => {
  ratingScore.value = 5
  ratingComment.value = ''
  ratingTags.value = []
  tipSent.value = false
  customTipVisible.value = false
  customTipAmount.value = null
})

async function submitTripRating() {
  const trip = props.activeTrip
  if (!trip || trips.isRating)
    return

  try {
    await trips.submitRating(trip.id, ratingScore.value, ratingComment.value, ratingTags.value)
    toast.success('Спасибо', 'Оценка отправлена.')
  }
  catch {}
}

async function sendTip(amount: number) {
  const trip = props.activeTrip
  if (!trip || tipPending.value || tipSent.value)
    return
  if (!Number.isFinite(amount) || amount < 100 || amount > 5000) {
    toast.error('Чаевые', 'Сумма — от 100 до 5000 ₸.')
    return
  }

  tipPending.value = true
  try {
    await sendTripTip(trip.id, amount)
    tipSent.value = true
    toast.success('Спасибо', 'Чаевые отправлены водителю 🙌')
  }
  catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      tipSent.value = true
      return
    }
    if (error instanceof ApiError && error.status === 402) {
      toast.error('Чаевые', 'Не хватает средств: пополните кошелёк или привяжите карту в «Кошельке».')
      return
    }
    showErrorToast(error, 'Не удалось отправить чаевые, попробуйте ещё раз.')
  }
  finally {
    tipPending.value = false
  }
}

const statusMeta = computed(() => {
  switch (props.activeTrip?.status) {
    case 'awaiting_payment':
      return {
        description: 'Оплатите заказ — и мы сразу начнём поиск водителя.',
        icon: 'i-mdi-credit-card-clock-outline',
        tone: 'text-main-300',
        title: 'Ожидание оплаты',
      }
    case 'driver_assigned':
      return {
        description: 'Водитель принял заказ и едет к вам.',
        icon: 'i-mdi-car-clock',
        tone: 'text-main-300',
        title: 'Водитель найден',
      }
    case 'driver_arriving':
      return {
        description: 'Водитель прибыл к месту посадки.',
        icon: 'i-mdi-map-marker-check',
        tone: 'text-emerald-300',
        title: 'Водитель на месте',
      }
    case 'in_progress':
      return {
        description: 'Поездка началась. Хорошей дороги.',
        icon: 'i-mdi-navigation-variant',
        tone: 'text-main-300',
        title: 'Вы в пути',
      }
    case 'completed':
      return {
        description: 'Поездка завершена. Спасибо, что выбрали нас!',
        icon: 'i-mdi-check-circle',
        tone: 'text-emerald-300',
        title: 'Вы доехали',
      }
    case 'cancelled':
      if (props.activeTrip?.cancelled_by === 'system_no_drivers') {
        return {
          description: 'Свободных машин рядом пока нет. Попробуйте заказать ещё раз через пару минут.',
          icon: 'i-mdi-car-off',
          tone: 'text-amber-300',
          title: 'Машин нет',
        }
      }
      return {
        description: 'Поездка отменена.',
        icon: 'i-mdi-close-circle',
        tone: 'text-red-300',
        title: 'Заказ отменен',
      }
    default:
      return {
        description: 'Обычно это занимает меньше минуты',
        icon: 'i-mdi-radar',
        tone: 'text-main-300',
        title: 'Ищем водителя',
      }
  }
})

const fareText = computed(() => {
  if (props.activeTrip)
    return `${Math.round(props.activeTrip.estimated_fare).toLocaleString('ru-RU')} ₸`

  return props.selectedEstimate ? formatFare(props.selectedEstimate) : 'Цена рассчитана'
})

const category = computed(() => props.activeTrip?.category ?? props.selectedCategories[0] ?? 'economy')

// Пока заказ ещё в поиске и выбрано несколько тарифов — показываем список того,
// что ищем. После того как заказ принят (или это уже терминальный статус),
// backend фиксирует итоговую категорию и цену — показываем именно их.
const isSearchingAcrossCategories = computed(() => {
  return props.activeTrip?.status === 'searching' && props.selectedCategories.length > 1
})

const tariffLine = computed(() => {
  if (isSearchingAcrossCategories.value) {
    const labels = props.selectedCategories.map(cat => TARIFF_META[cat].label).join(' · ')
    return `Ищем: ${labels}`
  }

  return `${TARIFF_META[category.value].label} · ${fareText.value}`
})

// Водитель показывается, когда заказ принят (бэкенд добавляет объект driver).
const driver = computed(() => props.activeTrip?.driver ?? null)

// Перевозчик — таксопарк поездки. Приезжает только когда водитель приписан к
// парку: у самозанятых объекта нет, и блок не показывается.
const carrier = computed(() => props.activeTrip?.carrier ?? null)

// Отдельный инстанс копирования: общий с «поделиться ссылкой» показывал бы
// галочку не в том месте.
const { copy: copyPhone, copied: carrierPhoneCopied } = useClipboard({ legacy: true })

function copyCarrierPhone(phone: string) {
  copyPhone(phone)
}

const { share, isSupported: isShareSupported } = useShare()
const { copy, copied: linkCopied } = useClipboard({ legacy: true })
const isSharing = ref(false)
const shareError = ref(false)

const TRAILING_SLASH_RE = /\/$/

function getShareBaseUrl() {
  const configuredUrl = (import.meta.env.VITE_SHARE_URL || import.meta.env.VITE_PUBLIC_SITE_URL) as string | undefined

  if (configuredUrl)
    return configuredUrl.replace(TRAILING_SLASH_RE, '')

  return window.location.origin
}

function buildShareUrl(token: string) {
  return `${getShareBaseUrl()}/share/${token}`
}

async function shareTrip() {
  if (!props.activeTrip || isSharing.value)
    return
  isSharing.value = true
  shareError.value = false
  try {
    const { share_token } = await shareTripLink(props.activeTrip.id)
    const shareUrl = buildShareUrl(share_token)

    if (isShareSupported.value) {
      await share({ title: 'Моя поездка Telegram Taxi', url: shareUrl })
    }
    else {
      await copy(shareUrl)
    }
  }
  catch {
    shareError.value = true
    setTimeout(() => {
      shareError.value = false
    }, 2500)
  }
  finally {
    isSharing.value = false
  }
}
</script>

<template>
  <div class="pb-4 pt-7 text-center">
    <!-- Радар: пока ищем — от иконки расходятся пульсирующие кольца.
         pt-7 сверху + умеренный масштаб колец, чтобы пульс не срезался краем шторки. -->
    <div class="relative mx-auto h-22 w-22">
      <template v-if="isSearchingStatus">
        <span class="sonar-ring absolute inset-0 rounded-full bg-main-500/14" aria-hidden="true" />
        <span class="sonar-ring absolute inset-0 rounded-full bg-main-500/14" style="animation-delay: 0.75s" aria-hidden="true" />
        <span class="sonar-ring absolute inset-0 rounded-full bg-main-500/14" style="animation-delay: 1.5s" aria-hidden="true" />
      </template>
      <div
        class="absolute inset-2.5 flex items-center justify-center border border-main-400/25 rounded-full bg-main-500/16"
        :class="statusMeta.tone"
      >
        <span class="text-8" :class="statusMeta.icon" />
      </div>
    </div>

    <h2 class="mt-4 text-xl font-950">
      {{ statusMeta.title }}
    </h2>

    <p class="mt-1 text-sm text-slate-400 font-700">
      {{ statusMeta.description }}
    </p>

    <!-- Тикающий таймер поиска -->
    <div v-if="isSearchingStatus" class="mt-3 inline-flex items-center gap-2 rounded-full bg-white/6 px-4 py-1.5">
      <span class="i-mdi-timer-outline text-4 text-main-300" aria-hidden="true" />
      <span class="text-sm font-950 tabular-nums">{{ elapsedLabel }}</span>
    </div>

    <!-- Живой ETA: водитель едет к вам / до прибытия в точку Б -->
    <div v-else-if="etaChip" class="mt-3 inline-flex items-center gap-2 rounded-full bg-main-500/14 px-4 py-1.5">
      <span class="i-mdi-clock-fast text-4 text-main-300" aria-hidden="true" />
      <span class="text-sm text-main-200 font-950 tabular-nums">{{ etaChip }}</span>
    </div>

    <div class="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-left">
      <p class="flex items-center gap-2 text-sm font-800">
        <span class="i-mdi-near-me shrink-0 text-4.5 text-main-300" aria-hidden="true" />
        <span class="truncate">{{ pickup }}</span>
      </p>
      <!-- Промежуточные остановки поездки -->
      <p
        v-for="(stop, index) in activeTrip?.stops ?? []"
        :key="`trip-stop-${index}`"
        class="mt-2 flex items-center gap-2 text-sm text-white/80 font-800"
      >
        <span
          class="h-4.5 w-4.5 flex shrink-0 items-center justify-center rounded-full bg-main-500/22 text-[10px] text-main-200 font-950"
          aria-hidden="true"
        >
          {{ index + 1 }}
        </span>
        <span class="truncate">{{ stop.address }}</span>
      </p>
      <p class="mt-2 flex items-center gap-2 text-sm font-800">
        <span class="i-mdi-flag-checkered shrink-0 text-4.5 text-main-300" aria-hidden="true" />
        <span class="truncate">{{ destination }}</span>
      </p>
      <p class="mt-2.5 border-t border-white/6 pt-2.5 text-xs text-slate-400 font-700">
        {{ tariffLine }}
      </p>
    </div>

    <!-- Остановка по пути: предложить водителю заехать ещё в одно место -->
    <button
      v-if="canProposeStop"
      type="button"
      class="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm font-800 transition active:scale-98"
      @click="startStopPicker"
    >
      <span class="i-mdi-map-marker-plus shrink-0 text-4.5 text-main-300" aria-hidden="true" />
      <span>Заехать по пути</span>
    </button>

    <!-- Заявка отправлена: ждём ответа водителя. Доплату показываем ту, что
         посчитал бэкенд, — ровно её увидит и водитель. -->
    <div v-if="pendingRouteChange" class="mt-3 rounded-2xl bg-main-500/12 px-4 py-3 text-left">
      <p class="flex items-center gap-2 text-sm text-main-200 font-900">
        <span class="i-mdi-clock-outline shrink-0 text-4.5" aria-hidden="true" />
        <span>Ждём ответа водителя</span>
      </p>
      <p class="mt-1.5 text-xs text-slate-300 font-700">
        Доплата за остановку — {{ formatTenge(pendingRouteChange.fee) }}.
        Если водитель откажется, поездка поедет прежним маршрутом и доплаты не будет.
      </p>
      <button
        type="button"
        class="mt-2.5 text-xs text-slate-400 font-800 underline underline-offset-2 disabled:opacity-50"
        :disabled="trips.isProposingRouteChange"
        @click="cancelStopRequest"
      >
        Отменить остановку
      </button>
    </div>

    <!-- Водитель ответил. Плашка одноразовая: закрывается и больше не всплывает. -->
    <div
      v-else-if="trips.routeChangeOutcome"
      class="mt-3 flex items-start gap-2 rounded-2xl px-4 py-3 text-left"
      :class="trips.routeChangeOutcome === 'accepted' ? 'bg-emerald-500/12' : 'bg-white/5'"
    >
      <span
        class="mt-0.5 shrink-0 text-4.5"
        :class="trips.routeChangeOutcome === 'accepted'
          ? 'i-mdi-check-circle text-emerald-300'
          : 'i-mdi-close-circle text-slate-400'"
        aria-hidden="true"
      />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-900" :class="trips.routeChangeOutcome === 'accepted' ? 'text-emerald-200' : 'text-slate-200'">
          {{ trips.routeChangeOutcome === 'accepted' ? 'Водитель согласился заехать' : 'Водитель отказался от остановки' }}
        </p>
        <p class="mt-1 text-xs text-slate-400 font-700">
          {{ trips.routeChangeOutcome === 'accepted'
            ? 'Остановка добавлена в маршрут, доплата уже учтена в стоимости.'
            : 'Маршрут и цена поездки не изменились.' }}
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 p-1 text-slate-400"
        aria-label="Закрыть"
        @click="trips.clearRouteChangeOutcome()"
      >
        <span class="i-mdi-close text-4" aria-hidden="true" />
      </button>
    </div>

    <!-- Карточка водителя — показывается после принятия заказа -->
    <div v-if="driver" class="mt-3 flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-3 text-left">
      <div class="h-14 w-14 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
        <img v-if="driver.avatar_url" :src="mediaUrl(driver.avatar_url)" alt="" class="h-full w-full object-cover">
        <span v-else class="i-mdi-account text-7 text-slate-400" />
      </div>

      <div class="min-w-0 flex-1">
        <p class="flex items-center gap-1.5 truncate text-sm font-900">
          {{ driver.name || 'Водитель' }}
          <span class="shrink-0 text-xs text-amber-300 font-800">★ {{ driver.rating.toFixed(1) }}</span>
        </p>
        <p v-if="driver.vehicle" class="mt-0.5 truncate text-xs text-slate-400 font-700">
          {{ driver.vehicle.make }} {{ driver.vehicle.model }} · {{ driver.vehicle.color }}
        </p>
        <p v-if="driver.vehicle" class="mt-0.5 inline-block rounded-md bg-white/10 px-2 py-0.5 text-xs font-900 tracking-wide">
          {{ driver.vehicle.plate_number }}
        </p>
      </div>
    </div>

    <!-- Перевозчик: пассажир вправе знать, кто фактически выполняет поездку.
         Телефон здесь корпоративный, парка — личных контактов водителя мы
         по-прежнему не показываем. У части парков телефон и БИН не заполнены,
         поэтому каждая строка со своим v-if; у самозанятого водителя объекта
         carrier нет вовсе, и блок не рисуется. -->
    <div v-if="carrier" class="mt-2 rounded-2xl bg-white/5 px-3 py-3 text-left">
      <p class="text-[11px] text-slate-500 font-800 uppercase">
        Перевозчик
      </p>
      <p class="mt-1 truncate text-sm font-900">
        {{ carrier.name }}
      </p>
      <p v-if="carrier.bin" class="mt-0.5 text-xs text-slate-400 font-700">
        БИН {{ carrier.bin }}
      </p>

      <!-- Не tel:-ссылка: Telegram-вебвью блокирует такую навигацию, и кнопка
           «позвонить» просто ничего бы не делала (на этом уже обожглись в
           вызове 112). Тап копирует номер — набрать его пользователь сможет
           в своей звонилке. -->
      <button
        v-if="carrier.phone"
        class="mt-2 h-10 w-full flex items-center justify-center gap-2 rounded-xl bg-white/8 text-sm text-white font-900 transition active:scale-[0.98]"
        type="button"
        @click="copyCarrierPhone(carrier.phone)"
      >
        <span :class="carrierPhoneCopied ? 'i-mdi-check' : 'i-mdi-content-copy'" class="text-4.5" />
        {{ carrierPhoneCopied ? 'Номер скопирован' : carrier.phone }}
      </button>
    </div>

    <!-- Связь после поездки. Пока поездка активна, ниже есть «Чат с водителем»,
         но на завершённой чат уже закрыт на запись — а вспоминают о забытых
         вещах как раз тогда. Телефон водителя пассажиру не показываем
         (приватность), поэтому ведём в поддержку: она видит контакты обеих
         сторон и связывает их сама. -->
    <RouterLink
      v-if="isCompleted && driver"
      to="/menu/support"
      class="mt-2 h-12 w-full flex items-center justify-center gap-2 rounded-2xl bg-white/8 text-sm text-white font-900 transition active:scale-[0.98]"
    >
      <span class="i-mdi-bag-suitcase text-5" />
      Забыл вещь в машине
    </RouterLink>

    <!-- Платное ожидание: таймер после прибытия водителя -->
    <div
      v-if="waitingInfo"
      class="mt-3 rounded-2xl px-4 py-3 text-left"
      :class="waitingInfo.accent ? 'bg-amber-500/12' : 'bg-white/5'"
    >
      <p class="text-xs font-800 leading-5" :class="waitingInfo.accent ? 'text-amber-200' : 'text-slate-300'">
        <span class="i-mdi-timer-sand mr-1 inline-block align-middle text-4" />
        {{ waitingInfo.text }}
      </p>
    </div>

    <!-- Кнопки активной поездки: чат с водителем и «Уже выхожу» -->
    <div v-if="isChatAvailable" class="mt-3 space-y-2">
      <button
        v-if="isDriverArrived"
        :disabled="isSendingOnMyWay"
        class="h-12 w-full flex items-center justify-center gap-2 rounded-2xl bg-main-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.26)] transition active:scale-[0.98] disabled:opacity-60"
        type="button"
        @click="sendOnMyWay"
      >
        <span class="i-mdi-run-fast text-5" />
        {{ isSendingOnMyWay ? 'Отправляем...' : 'Уже выхожу' }}
      </button>

      <button
        class="relative h-12 w-full flex items-center justify-center gap-2 rounded-2xl bg-white/8 text-sm text-white font-900 transition active:scale-[0.98]"
        type="button"
        @click="openChat"
      >
        <span class="i-mdi-message-text text-5" />
        Чат с водителем
        <span
          v-if="tripChat.unreadCount"
          class="absolute right-3 min-w-5 flex items-center justify-center rounded-full bg-main-500 px-1.5 py-0.5 text-[11px] text-white font-900"
        >
          {{ tripChat.unreadCount }}
        </span>
      </button>
    </div>

    <!-- Итог завершённой поездки: время пути, время завершения, стоимость -->
    <div v-if="isCompleted" class="grid grid-cols-3 mt-3 gap-2">
      <div class="rounded-2xl bg-white/5 px-2 py-2.5">
        <p class="text-[11px] text-slate-500 font-800">
          Время пути
        </p>
        <p class="mt-1 text-sm font-950">
          {{ tripDurationText ?? '—' }}
        </p>
      </div>
      <div class="rounded-2xl bg-white/5 px-2 py-2.5">
        <p class="text-[11px] text-slate-500 font-800">
          Завершена
        </p>
        <p class="mt-1 text-sm font-950">
          {{ completedAtText ?? '—' }}
        </p>
      </div>
      <div class="rounded-2xl bg-white/5 px-2 py-2.5">
        <p class="text-[11px] text-slate-500 font-800">
          Стоимость
        </p>
        <p class="mt-1 text-sm font-950">
          {{ finalFareText ?? '—' }}
        </p>
      </div>
    </div>

    <!-- Оценка водителя: форма после завершения, «спасибо» — если уже оценено -->
    <div v-if="isCompleted && driver" class="mt-3 rounded-2xl bg-white/5 px-4 py-4 text-left">
      <template v-if="ratedScore">
        <p class="text-center text-sm font-900">
          Ваша оценка
        </p>
        <div class="mt-2 flex justify-center gap-1">
          <span
            v-for="star in 5"
            :key="star"
            class="i-mdi-star text-7"
            :class="star <= ratedScore ? 'text-main-300' : 'text-slate-600'"
            aria-hidden="true"
          />
        </div>
        <p class="mt-2 text-center text-xs text-emerald-300 font-800">
          Спасибо за оценку!
        </p>
      </template>

      <template v-else>
        <p class="text-center text-sm font-900">
          Оцените поездку
        </p>
        <div class="mt-2 flex justify-center gap-1">
          <button
            v-for="star in 5"
            :key="star"
            :aria-label="`Поставить оценку ${star}`"
            class="h-11 w-11 flex items-center justify-center rounded-full transition active:scale-[0.94]"
            :class="star <= ratingScore ? 'text-main-300' : 'text-slate-600'"
            type="button"
            @click="ratingScore = star"
          >
            <span class="i-mdi-star text-8" aria-hidden="true" />
          </button>
        </div>
        <!-- Чипы-теги: 4-5 звёзд — что понравилось, 1-3 — что не так -->
        <div class="mt-3 flex flex-wrap justify-center gap-1.5">
          <button
            v-for="tag in visibleRatingTags"
            :key="tag.value"
            class="h-8 rounded-full px-3 text-xs font-800 transition active:scale-[0.96]"
            :class="ratingTags.includes(tag.value)
              ? 'bg-main-500/22 text-main-200 border border-main-400/50'
              : 'bg-white/6 text-slate-300 border border-transparent'"
            type="button"
            @click="toggleRatingTag(tag.value)"
          >
            {{ tag.label }}
          </button>
        </div>
        <textarea
          v-model="ratingComment"
          aria-label="Комментарий к поездке"
          class="mt-3 min-h-20 w-full resize-none border border-white/10 rounded-2xl bg-white/6 p-3 text-sm outline-none focus:border-main-400"
          maxlength="500"
          name="trip_rating_comment"
          placeholder="Комментарий к заказу, если хотите"
        />
        <button
          :disabled="trips.isRating"
          class="mt-3 h-12 w-full rounded-2xl bg-main-500 text-sm text-white font-950 transition active:scale-[0.98] disabled:opacity-60"
          type="button"
          @click="submitTripRating"
        >
          {{ trips.isRating ? 'Отправляем...' : 'Отправить оценку' }}
        </button>
      </template>
    </div>

    <!-- Чаевые водителю: 100/200 ₸ или своя сумма (100-5000) -->
    <div v-if="isCompleted && driver" class="mt-3 rounded-2xl bg-white/5 px-4 py-4 text-left">
      <template v-if="tipSent">
        <p class="text-center text-sm text-emerald-300 font-900">
          Чаевые отправлены 🙌
        </p>
      </template>
      <template v-else>
        <p class="text-center text-sm font-900">
          Оставить чаевые водителю
        </p>
        <div class="grid grid-cols-3 mt-3 gap-2">
          <button
            :disabled="tipPending"
            class="h-11 rounded-2xl bg-white/8 text-sm font-950 transition active:scale-[0.97] disabled:opacity-60"
            type="button"
            @click="sendTip(100)"
          >
            100 ₸
          </button>
          <button
            :disabled="tipPending"
            class="h-11 rounded-2xl bg-white/8 text-sm font-950 transition active:scale-[0.97] disabled:opacity-60"
            type="button"
            @click="sendTip(200)"
          >
            200 ₸
          </button>
          <button
            :disabled="tipPending"
            class="h-11 rounded-2xl text-sm font-950 transition active:scale-[0.97] disabled:opacity-60"
            :class="customTipVisible ? 'bg-main-500/22 text-main-200' : 'bg-white/8'"
            type="button"
            @click="customTipVisible = !customTipVisible"
          >
            Своя
          </button>
        </div>
        <div v-if="customTipVisible" class="mt-2 flex gap-2">
          <input
            v-model.number="customTipAmount"
            aria-label="Своя сумма чаевых"
            class="h-11 min-w-0 flex-1 border border-white/10 rounded-2xl bg-white/6 px-3 text-sm outline-none focus:border-main-400"
            inputmode="numeric"
            max="5000"
            min="100"
            placeholder="От 100 до 5000 ₸"
            type="number"
          >
          <button
            :disabled="tipPending || !customTipAmount"
            class="h-11 shrink-0 rounded-2xl bg-main-500 px-4 text-sm text-white font-950 transition active:scale-[0.97] disabled:opacity-60"
            type="button"
            @click="sendTip(Number(customTipAmount))"
          >
            {{ tipPending ? '...' : 'Отправить' }}
          </button>
        </div>
        <p class="mt-2 text-center text-[11px] text-slate-500 leading-4">
          Спишутся с кошелька или привязанной карты и уйдут водителю полностью — без комиссии.
        </p>
      </template>
    </div>

    <label
      v-if="isCompleted && !isAlreadyFavorite"
      class="mt-3 flex cursor-pointer items-center gap-2.5 rounded-2xl bg-white/5 px-3 py-2.5 text-left transition active:scale-[0.99]"
    >
      <input
        :checked="isFavoriteSaved"
        :disabled="isFavoriteSaved || places.isMutating"
        class="h-4.5 w-4.5 shrink-0 accent-main-500"
        type="checkbox"
        @change="toggleSaveFavorite"
      >
      <span class="min-w-0 text-xs text-slate-300 font-700 leading-4">
        {{ isFavoriteSaved ? 'Добавлено в избранное' : 'Добавить это место в избранное' }}
      </span>
    </label>

    <button
      v-if="isChatAvailable"
      :disabled="isSharing"
      class="mt-4 h-11 w-full rounded-2xl bg-white/8 text-sm text-white font-900 transition active:scale-[0.98] disabled:opacity-60"
      type="button"
      @click="shareTrip()"
    >
      <span v-if="shareError" class="text-red-300">Не удалось поделиться</span>
      <span v-else-if="linkCopied && !isSharing" class="text-emerald-300">Ссылка скопирована</span>
      <span v-else-if="isSharing">Подготовка ссылки...</span>
      <span v-else class="flex items-center justify-center gap-2">
        <span class="i-mdi-share-variant text-5" />
        Поделиться поездкой
      </span>
    </button>
  </div>
</template>

<style scoped>
.sonar-ring {
  animation: sonar 2.25s ease-out infinite;
}

@keyframes sonar {
  from {
    opacity: 0.9;
    transform: scale(0.65);
  }
  to {
    opacity: 0;
    transform: scale(1.55);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sonar-ring {
    animation: none;
    opacity: 0;
  }
}
</style>
