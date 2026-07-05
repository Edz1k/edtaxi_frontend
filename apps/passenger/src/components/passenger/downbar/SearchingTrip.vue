<script setup lang="ts">
import type { EstimateTripResponse, Trip, VehicleCategory } from '~/types/trips'
import { mediaUrl } from '~/api/client'
import { shareTripLink } from '~/api/share'
import { formatFare, TARIFF_META } from '~/constants/tariffs'
import { usePlacesStore } from '~/stores/places'
import { useTripChatStore } from '~/stores/tripChat'

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

const statusMeta = computed(() => {
  switch (props.activeTrip?.status) {
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
      await share({ title: 'Моя поездка EdTaxi', url: shareUrl })
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

    <div class="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-left">
      <p class="flex items-center gap-2 text-sm font-800">
        <span class="i-mdi-near-me shrink-0 text-4.5 text-main-300" aria-hidden="true" />
        <span class="truncate">{{ pickup }}</span>
      </p>
      <p class="mt-2 flex items-center gap-2 text-sm font-800">
        <span class="i-mdi-flag-checkered shrink-0 text-4.5 text-main-300" aria-hidden="true" />
        <span class="truncate">{{ destination }}</span>
      </p>
      <p class="mt-2.5 border-t border-white/6 pt-2.5 text-xs text-slate-400 font-700">
        {{ tariffLine }}
      </p>
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

      <a
        v-if="driver.phone"
        :href="`tel:${driver.phone}`"
        class="h-11 w-11 flex shrink-0 items-center justify-center rounded-full bg-main-500/20 text-main-300 transition active:scale-[0.95]"
        aria-label="Позвонить водителю"
      >
        <span class="i-mdi-phone text-5" />
      </a>
    </div>

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
      v-if="activeTrip?.status === 'in_progress'"
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
