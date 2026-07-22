<script setup lang="ts">
import type { BonusPromotion } from '@edtaxi/shared/types/bonus'
import type { AvailablePark, ParkInfo, ParkJoinRequest } from '~/types/park'
import { getMyPromotions, joinPromotion } from '@edtaxi/shared/api/bonus'
import { getDriverOverview } from '~/api/driver'
import { showErrorToast } from '~/api/errors'
import {
  applyToPark,
  applyToPlatformPark,
  getMyParkRequest,
  getParkInfo,
  getPlatformParkAvailability,
  listAvailableParks,
} from '~/api/park'
import { useToast } from '~/composables/useToast'
import { useDriverStore } from '~/stores/driver'

const toast = useToast()
const driver = useDriverStore()
const { t, locale } = useI18n()

const parks = ref<AvailablePark[]>([])
const myRequest = ref<null | ParkJoinRequest>(null)
const isPlatformAvailable = ref(false)
// park_id из обзора водителя: если он есть — водитель уже в парке (тогда доступна
// смена парка, а не первичное вступление).
const parkId = ref<null | string>(null)
const isLoading = ref(true)
const isApplying = ref(false)

// Карточка СВОЕГО парка (имя/комиссия) + его акции с прогрессом. Пока водитель
// в парке, список чужих парков спрятан за кнопкой «Сменить таксопарк».
const myPark = ref<null | ParkInfo>(null)
const myPromos = ref<BonusPromotion[]>([])
const joiningPromoId = ref('')
const showSwitchList = ref(false)

// Раскрытая карточка парка: детали (описание, телефон, акции) подгружаются
// по клику и кэшируются, чтобы не дёргать бэк при повторном раскрытии.
const expandedParkId = ref('')
const parkDetails = ref<Record<string, ParkInfo>>({})
const isLoadingDetails = ref(false)

// Код приглашения от владельца парка — прямое вступление без заявки
// (бывшая отдельная страница /menu/park-invite, объединена сюда).
const inviteToken = ref('')

// Подтверждение смены парка: когда водитель уже в парке, заявка в другой парк
// означает уход из текущего — спрашиваем подтверждение перед отправкой.
const switchTarget = ref<null | { name: string, run: () => Promise<void> }>(null)

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    screenSubtitle: 'nav.backToMenu',
    screenTitle: 'titles.parks',
  },
})

useHead({
  title: () => `${t('titles.parks')} | Telegram Taxi`,
})

const hasPark = computed(() => Boolean(parkId.value))
const pendingRequest = computed(() =>
  myRequest.value?.status === 'pending' ? myRequest.value : null,
)
// Отправить заявку (вступление или смена) можно, пока нет активной заявки.
const canRequest = computed(() => !pendingRequest.value)
// В режиме смены парка не показываем в списке текущий парк водителя.
const displayedParks = computed(() =>
  hasPark.value ? parks.value.filter(park => park.id !== parkId.value) : parks.value,
)

onMounted(async () => {
  try {
    // Каждый запрос независим: упавший обзор не должен прятать список парков.
    const [overview, request, list, platform] = await Promise.allSettled([
      getDriverOverview(),
      getMyParkRequest(),
      listAvailableParks({ limit: 50 }),
      getPlatformParkAvailability(),
    ])
    if (overview.status === 'fulfilled')
      parkId.value = overview.value.driver.park_id
    if (request.status === 'fulfilled')
      myRequest.value = request.value.request
    if (list.status === 'fulfilled')
      parks.value = list.value.parks
    if (platform.status === 'fulfilled')
      isPlatformAvailable.value = platform.value.available

    if (parkId.value)
      await Promise.allSettled([loadMyPark(parkId.value), loadMyPromotions()])
  }
  finally {
    isLoading.value = false
  }
})

async function loadMyPark(id: string) {
  try {
    myPark.value = await getParkInfo(id)
  }
  catch {
    // имя/комиссия не критичны — карточка покажет общую надпись
  }
}

// Парковые акции с прогрессом (joined=false → прогресс ещё не считается).
async function loadMyPromotions() {
  try {
    const response = await getMyPromotions('driver')
    myPromos.value = response.promotions.filter(promo => promo.scope === 'park')
  }
  catch {
    myPromos.value = []
  }
}

async function joinPromo(promo: BonusPromotion) {
  if (joiningPromoId.value)
    return
  joiningPromoId.value = promo.id
  try {
    await joinPromotion(promo.id)
    toast.success(t('parks.joinedPromoTitle'), t('parks.joinedPromoText'))
    await loadMyPromotions()
  }
  catch (error) {
    showErrorToast(error, t('parks.joinPromoFail'))
  }
  finally {
    joiningPromoId.value = ''
  }
}

function promoProgress(promo: BonusPromotion) {
  if (promo.target_trips <= 0)
    return 0
  return Math.min(100, Math.round((promo.my_trips / promo.target_trips) * 100))
}

// commission_rate приходит долей (0.03 → 3%)
function commissionLabel(rate: number) {
  return `${(rate * 100).toLocaleString(locale.value, { maximumFractionDigits: 1 })}%`
}

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long' }).format(new Date(value))
}

async function toggleDetails(park: AvailablePark) {
  if (expandedParkId.value === park.id) {
    expandedParkId.value = ''
    return
  }

  expandedParkId.value = park.id
  if (parkDetails.value[park.id])
    return

  isLoadingDetails.value = true
  try {
    parkDetails.value[park.id] = await getParkInfo(park.id)
  }
  catch (error) {
    showErrorToast(error, t('parks.detailsFail'))
  }
  finally {
    isLoadingDetails.value = false
  }
}

async function refreshRequest() {
  try {
    myRequest.value = (await getMyParkRequest()).request
  }
  catch {
    // заявка перезагрузится при следующем открытии страницы
  }
}

async function apply(id: string) {
  if (isApplying.value)
    return

  isApplying.value = true
  try {
    await applyToPark(id)
    toast.success(
      hasPark.value ? t('parks.switchSentTitle') : t('parks.requestSentTitle'),
      t('parks.requestSentText'),
    )
    await refreshRequest()
  }
  catch (error) {
    showErrorToast(error, t('parks.requestFail'))
  }
  finally {
    isApplying.value = false
  }
}

async function applyPlatform() {
  if (isApplying.value)
    return

  isApplying.value = true
  try {
    await applyToPlatformPark()
    toast.success(t('parks.requestSentTitle'), t('parks.platformSentText'))
    await refreshRequest()
  }
  catch (error) {
    showErrorToast(error, t('parks.requestFail'))
  }
  finally {
    isApplying.value = false
  }
}

// В парке — сначала подтверждение (уход из текущего), без парка — заявка сразу.
function requestPark(park: AvailablePark) {
  if (hasPark.value)
    switchTarget.value = { name: park.name, run: () => apply(park.id) }
  else
    apply(park.id)
}

function requestPlatform() {
  if (hasPark.value)
    switchTarget.value = { name: t('parks.platformPartnership'), run: applyPlatform }
  else
    applyPlatform()
}

async function confirmSwitch() {
  const target = switchTarget.value
  if (!target)
    return
  switchTarget.value = null
  await target.run()
}

async function acceptInvite() {
  await driver.acceptParkInvite(inviteToken.value.trim())
  inviteToken.value = ''
  toast.success(t('changePhone.doneTitle'), t('parks.joinedPark'))
  // Обновляем членство, чтобы страница сразу показала «Вы состоите в таксопарке»
  try {
    parkId.value = (await getDriverOverview()).driver.park_id
  }
  catch {
    // не критично: статус подтянётся при следующем открытии страницы
  }
}
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto app-screen pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header>
        <p class="text-xs app-accent font-900 uppercase">
          {{ t('nav.driver') }}
        </p>
        <h1 class="mt-1 text-3xl font-950">
          {{ t('titles.parks') }}
        </h1>
        <p class="mt-2 text-sm app-muted leading-5">
          {{ t('parks.lead') }}
        </p>
      </header>

      <div v-if="isLoading" class="mt-6 space-y-2">
        <div v-for="item in 3" :key="item" class="h-20 animate-pulse rounded-2xl app-card" />
      </div>

      <template v-else>
        <!-- Уже в парке: карточка своего парка с комиссией -->
        <div v-if="hasPark" class="mt-6 rounded-3xl bg-emerald-500/12 p-4">
          <div class="flex items-center gap-3">
            <span class="i-mdi-check-decagram shrink-0 text-7 text-emerald-300" />
            <div class="min-w-0">
              <p class="text-sm text-emerald-200 font-950">
                {{ t('parks.workingWith', { name: myPark?.name ? `«${myPark.name}»` : '' }) }}
              </p>
              <p v-if="myPark" class="mt-0.5 text-xs text-emerald-300/80 font-800 leading-4">
                {{ t('parks.parkCommission', { rate: commissionLabel(myPark.commission_rate) }) }}
              </p>
              <p class="mt-0.5 text-xs text-emerald-300/60 leading-4">
                {{ t('parks.contactHint') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Акции моего парка: прогресс считается после кнопки «Участвовать» -->
        <section v-if="hasPark && myPromos.length" class="mt-4">
          <h2 class="text-xs app-muted font-800 uppercase">
            {{ t('parks.parkPromos') }}
          </h2>
          <div class="mt-2 space-y-2">
            <article
              v-for="promo in myPromos"
              :key="promo.id"
              class="rounded-2xl app-card p-4"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="min-w-0 text-sm font-950">
                  {{ promo.title }}
                </p>
                <span class="shrink-0 text-xs text-main-200 font-900 light:text-main-700">
                  {{ t('bonus.promoReward', { n: Math.floor(promo.reward).toLocaleString(locale) }) }}
                </span>
              </div>
              <p v-if="promo.description" class="mt-1 text-xs app-muted leading-4">
                {{ promo.description }}
              </p>
              <p class="mt-1 text-xs app-faint font-700">
                {{ t('parks.promoMeta', { n: promo.target_trips, date: formatDeadline(promo.ends_at) }) }}
              </p>

              <!-- Участвует: прогресс-бар. Нет: кнопка «Участвовать». -->
              <template v-if="promo.joined">
                <div class="mt-3 h-2 overflow-hidden rounded-full app-chip">
                  <div
                    class="h-full rounded-full bg-main-400 transition-all"
                    :style="{ width: `${promoProgress(promo)}%` }"
                  />
                </div>
                <p class="mt-1.5 text-xs app-muted font-800">
                  {{ t('parks.promoProgress', { done: promo.my_trips, total: promo.target_trips }) }}
                  <span class="app-faint font-600">{{ t('parks.sinceJoin') }}</span>
                </p>
              </template>
              <button
                v-else
                :disabled="joiningPromoId === promo.id"
                class="mt-3 h-11 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
                type="button"
                @click="joinPromo(promo)"
              >
                {{ joiningPromoId === promo.id ? t('parks.joining') : t('parks.join') }}
              </button>
            </article>
          </div>
        </section>

        <!-- Заявка отправлена (первичное вступление, без парка) -->
        <div v-else-if="pendingRequest" class="mt-6 flex items-center gap-3 rounded-3xl bg-amber-500/12 p-4">
          <span class="i-mdi-clock-outline shrink-0 text-7 text-amber-300" />
          <p class="min-w-0 text-sm text-amber-200 font-800 leading-5">
            {{ t('parks.requestPendingIn', { name: pendingRequest.park_name || t('titles.parks') }) }}
          </p>
        </div>

        <!-- Заявка на СМЕНУ парка отправлена: имя парка + статус ожидания -->
        <div v-if="hasPark && pendingRequest" class="mt-3 flex items-center justify-between gap-3 rounded-3xl bg-amber-500/12 p-4">
          <div class="min-w-0">
            <p class="text-xs text-amber-300/70 font-900 uppercase">
              {{ t('parks.switchRequest') }}
            </p>
            <p class="mt-0.5 truncate text-base text-amber-100 font-950">
              {{ pendingRequest.park_name || t('parks.newPark') }}
            </p>
          </div>
          <span class="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-amber-500/18 px-3.5 py-2.5 text-xs text-amber-200 font-950">
            <span class="i-mdi-clock-outline text-4.5" />
            {{ t('parks.waiting') }}
          </span>
        </div>

        <!-- Код приглашения: прямое вступление, если владелец парка выдал token -->
        <form v-if="!hasPark" class="mt-6 rounded-3xl app-card p-4" @submit.prevent="acceptInvite">
          <label class="text-xs app-muted font-800 uppercase" for="park-token">
            {{ t('parks.inviteCode') }}
          </label>
          <p class="mt-1 text-xs app-faint leading-4">
            {{ t('parks.inviteHint') }}
          </p>
          <input
            id="park-token"
            v-model="inviteToken"
            class="mt-2 h-13 w-full border app-border rounded-2xl app-input-surface px-4 text-sm outline-none focus:border-main-400"
            :placeholder="t('parks.invitePlaceholder')"
          >
          <button
            :disabled="driver.isLoadingParkInvite || !inviteToken.trim()"
            class="mt-3 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
            type="submit"
          >
            {{ driver.isLoadingParkInvite ? t('parks.checking') : t('parks.joinPark') }}
          </button>
        </form>

        <!-- В парке список чужих парков спрятан: «водитель видит только свой
             парк». Смена — осознанное действие по кнопке ниже. -->
        <button
          v-if="hasPark && canRequest && !showSwitchList"
          class="mt-6 h-12 w-full flex items-center justify-center gap-2 rounded-2xl app-card text-sm text-slate-300 font-900 transition active:scale-[0.98] light:text-slate-600"
          type="button"
          @click="showSwitchList = true"
        >
          <span class="i-mdi-swap-horizontal text-5" />
          {{ t('parks.switchPark') }}
        </button>

        <!-- Список парков: вступление (без парка) или смена (в парке, после
             нажатия «Сменить таксопарк»). Пока есть активная заявка — список
             прячем, показываем статус выше. -->
        <section v-if="canRequest && (!hasPark || showSwitchList)" class="mt-6">
          <h2 class="text-xs app-muted font-800 uppercase">
            {{ hasPark ? t('parks.switchPark') : t('parks.availableParks') }}
          </h2>
          <p v-if="hasPark" class="mt-1 text-xs app-faint leading-4">
            {{ t('parks.switchHint') }}
          </p>

          <p v-if="!displayedParks.length" class="mt-3 text-sm app-faint">
            {{ hasPark ? t('parks.noOtherParks') : t('parks.noParks') }}
          </p>

          <div v-else class="mt-3 space-y-2">
            <article v-for="park in displayedParks" :key="park.id" class="overflow-hidden rounded-2xl app-card">
              <button
                class="w-full p-4 text-left transition active:app-card"
                type="button"
                @click="toggleDetails(park)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-base font-950">
                      {{ park.name }}
                    </p>
                    <p v-if="park.description" class="line-clamp-2 mt-1 text-xs app-muted leading-4">
                      {{ park.description }}
                    </p>
                  </div>
                  <span class="shrink-0 rounded-full bg-main-500/14 px-3 py-1.5 text-xs text-main-200 font-900 light:text-main-700">
                    {{ t('parks.commission', { rate: commissionLabel(park.commission_rate) }) }}
                  </span>
                </div>
              </button>

              <!-- Детали парка: описание, телефон, акции, кнопка заявки -->
              <div v-if="expandedParkId === park.id" class="border-t border-white/8 px-4 pb-4 pt-3">
                <div v-if="isLoadingDetails && !parkDetails[park.id]" class="space-y-2">
                  <div v-for="item in 2" :key="item" class="h-10 animate-pulse rounded-xl app-card" />
                </div>

                <template v-else-if="parkDetails[park.id]">
                  <p v-if="parkDetails[park.id].description" class="text-sm text-slate-300 leading-5 light:text-slate-600">
                    {{ parkDetails[park.id].description }}
                  </p>
                  <p v-if="parkDetails[park.id].phone" class="mt-2 text-xs app-muted font-700">
                    <span class="i-mdi-phone mr-1 inline-block align-middle text-3.5" />
                    {{ parkDetails[park.id].phone }}
                  </p>

                  <div v-if="parkDetails[park.id].promotions?.length" class="mt-3 space-y-2">
                    <p class="text-xs app-muted font-800 uppercase">
                      {{ t('parks.parkPromos') }}
                    </p>
                    <div
                      v-for="(promo, index) in parkDetails[park.id].promotions ?? []"
                      :key="index"
                      class="rounded-xl app-card px-3 py-2.5"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <p class="min-w-0 text-sm font-900">
                          {{ promo.title }}
                        </p>
                        <span class="shrink-0 text-xs text-main-200 font-900 light:text-main-700">
                          {{ t('bonus.promoReward', { n: Math.floor(promo.reward).toLocaleString(locale) }) }}
                        </span>
                      </div>
                      <p v-if="promo.description" class="mt-1 text-xs app-muted leading-4">
                        {{ promo.description }}
                      </p>
                      <p class="mt-1 text-xs app-faint font-700">
                        {{ t('parks.promoMeta', { n: promo.target_trips, date: formatDeadline(promo.ends_at) }) }}
                      </p>
                    </div>
                  </div>

                  <button
                    :disabled="isApplying"
                    class="mt-3 h-12 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
                    type="button"
                    @click="requestPark(park)"
                  >
                    {{ isApplying ? t('parks.sending') : t('parks.sendRequest') }}
                  </button>
                </template>
              </div>
            </article>
          </div>
        </section>

        <!-- Партнёрство с платформой (в парке — только в режиме смены) -->
        <section v-if="isPlatformAvailable && canRequest && (!hasPark || showSwitchList)" class="mt-8">
          <button
            :disabled="isApplying"
            class="h-14 w-full flex items-center justify-center gap-2 rounded-2xl bg-main-500 text-sm font-950 shadow-[0_12px_30px_rgba(230,173,46,0.28)] transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="requestPlatform"
          >
            <span class="i-mdi-handshake text-6" />
            {{ isApplying ? t('parks.sending') : (hasPark ? t('parks.switchToPlatform') : t('parks.becomePartner')) }}
          </button>
          <p class="mt-2 text-center text-xs app-muted leading-4">
            {{ t('parks.platformNote') }}
          </p>
        </section>
      </template>
    </section>

    <!-- Подтверждение смены парка -->
    <Teleport to="body">
      <div
        v-if="switchTarget"
        class="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @click.self="switchTarget = null"
      >
        <div class="max-w-sm w-full border app-border rounded-3xl app-screen p-5 shadow-2xl">
          <span class="h-12 w-12 flex items-center justify-center rounded-2xl bg-amber-500/14 text-amber-300">
            <span class="i-mdi-swap-horizontal text-7" />
          </span>
          <h3 class="mt-4 text-lg font-950">
            {{ t('parks.switchConfirmTitle') }}
          </h3>
          <p class="mt-2 text-sm app-muted leading-5">
            {{ t('parks.switchConfirmText', { name: switchTarget.name }) }}
          </p>

          <div class="mt-5 flex gap-2">
            <button
              class="h-12 flex-1 rounded-2xl app-chip text-sm font-900 transition active:scale-[0.98]"
              type="button"
              @click="switchTarget = null"
            >
              {{ t('support.no') }}
            </button>
            <button
              :disabled="isApplying"
              class="h-12 flex-1 rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
              type="button"
              @click="confirmSwitch"
            >
              {{ t('parks.yesSwitch') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>
