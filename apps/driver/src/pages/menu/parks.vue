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
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Таксопарк',
  },
})

useHead({
  title: 'Таксопарк | Telegram Taxi',
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
    toast.success('Вы участвуете!', 'Заказы начнут засчитываться с этого момента.')
    await loadMyPromotions()
  }
  catch (error) {
    showErrorToast(error, 'Не удалось вступить в акцию.')
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
  return `${(rate * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`
}

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(value))
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
    showErrorToast(error, 'Не удалось загрузить информацию о парке.')
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
      hasPark.value ? 'Заявка на смену отправлена' : 'Заявка отправлена',
      'Парк рассмотрит её и примет решение.',
    )
    await refreshRequest()
  }
  catch (error) {
    showErrorToast(error, 'Не удалось отправить заявку.')
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
    toast.success('Заявка отправлена', 'Мы рассмотрим её и примем решение.')
    await refreshRequest()
  }
  catch (error) {
    showErrorToast(error, 'Не удалось отправить заявку.')
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
    switchTarget.value = { name: 'партнёрство с платформой', run: applyPlatform }
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
  toast.success('Готово', 'Вы присоединились к таксопарку.')
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
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <header>
        <p class="text-xs text-main-300 font-900 uppercase">
          Водитель
        </p>
        <h1 class="mt-1 text-3xl font-950">
          Таксопарк
        </h1>
        <p class="mt-2 text-sm text-slate-400 leading-5">
          Для выхода на линию нужно состоять в таксопарке или стать партнёром платформы.
        </p>
      </header>

      <div v-if="isLoading" class="mt-6 space-y-2">
        <div v-for="item in 3" :key="item" class="h-20 animate-pulse rounded-2xl bg-white/6" />
      </div>

      <template v-else>
        <!-- Уже в парке: карточка своего парка с комиссией -->
        <div v-if="hasPark" class="mt-6 rounded-3xl bg-emerald-500/12 p-4">
          <div class="flex items-center gap-3">
            <span class="i-mdi-check-decagram shrink-0 text-7 text-emerald-300" />
            <div class="min-w-0">
              <p class="text-sm text-emerald-200 font-950">
                Успешно работаете с парком {{ myPark?.name ? `«${myPark.name}»` : '' }}
              </p>
              <p v-if="myPark" class="mt-0.5 text-xs text-emerald-300/80 font-800 leading-4">
                Комиссия парка составляет {{ commissionLabel(myPark.commission_rate) }}
              </p>
              <p class="mt-0.5 text-xs text-emerald-300/60 leading-4">
                Связаться с парком можно в разделе «Чат с парком».
              </p>
            </div>
          </div>
        </div>

        <!-- Акции моего парка: прогресс считается после кнопки «Участвовать» -->
        <section v-if="hasPark && myPromos.length" class="mt-4">
          <h2 class="text-xs text-slate-400 font-800 uppercase">
            Акции парка
          </h2>
          <div class="mt-2 space-y-2">
            <article
              v-for="promo in myPromos"
              :key="promo.id"
              class="rounded-2xl bg-white/5 p-4"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="min-w-0 text-sm font-950">
                  {{ promo.title }}
                </p>
                <span class="shrink-0 text-xs text-main-200 font-900">
                  +{{ Math.floor(promo.reward).toLocaleString('ru-RU') }} бонусов
                </span>
              </div>
              <p v-if="promo.description" class="mt-1 text-xs text-slate-400 leading-4">
                {{ promo.description }}
              </p>
              <p class="mt-1 text-xs text-slate-500 font-700">
                {{ promo.target_trips }} заказов · до {{ formatDeadline(promo.ends_at) }}
              </p>

              <!-- Участвует: прогресс-бар. Нет: кнопка «Участвовать». -->
              <template v-if="promo.joined">
                <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    class="h-full rounded-full bg-main-400 transition-all"
                    :style="{ width: `${promoProgress(promo)}%` }"
                  />
                </div>
                <p class="mt-1.5 text-xs text-slate-400 font-800">
                  {{ promo.my_trips }} из {{ promo.target_trips }} заказов
                  <span class="text-slate-500 font-600">· прогресс с момента вступления</span>
                </p>
              </template>
              <button
                v-else
                :disabled="joiningPromoId === promo.id"
                class="mt-3 h-11 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
                type="button"
                @click="joinPromo(promo)"
              >
                {{ joiningPromoId === promo.id ? 'Подключаем...' : 'Участвовать' }}
              </button>
            </article>
          </div>
        </section>

        <!-- Заявка отправлена (первичное вступление, без парка) -->
        <div v-else-if="pendingRequest" class="mt-6 flex items-center gap-3 rounded-3xl bg-amber-500/12 p-4">
          <span class="i-mdi-clock-outline shrink-0 text-7 text-amber-300" />
          <p class="min-w-0 text-sm text-amber-200 font-800 leading-5">
            Заявка отправлена в {{ pendingRequest.park_name || 'таксопарк' }}, ждём одобрения парка.
          </p>
        </div>

        <!-- Заявка на СМЕНУ парка отправлена: имя парка + статус ожидания -->
        <div v-if="hasPark && pendingRequest" class="mt-3 flex items-center justify-between gap-3 rounded-3xl bg-amber-500/12 p-4">
          <div class="min-w-0">
            <p class="text-xs text-amber-300/70 font-900 uppercase">
              Заявка на смену парка
            </p>
            <p class="mt-0.5 truncate text-base text-amber-100 font-950">
              {{ pendingRequest.park_name || 'Новый таксопарк' }}
            </p>
          </div>
          <span class="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-amber-500/18 px-3.5 py-2.5 text-xs text-amber-200 font-950">
            <span class="i-mdi-clock-outline text-4.5" />
            Ожидание
          </span>
        </div>

        <!-- Код приглашения: прямое вступление, если владелец парка выдал token -->
        <form v-if="!hasPark" class="mt-6 rounded-3xl bg-white/5 p-4" @submit.prevent="acceptInvite">
          <label class="text-xs text-slate-400 font-800 uppercase" for="park-token">
            Код приглашения
          </label>
          <p class="mt-1 text-xs text-slate-500 leading-4">
            Если владелец парка выдал вам код, введите его и вступите без заявки.
          </p>
          <input
            id="park-token"
            v-model="inviteToken"
            class="mt-2 h-13 w-full border border-white/10 rounded-2xl bg-secondary-950/70 px-4 text-sm outline-none focus:border-main-400"
            placeholder="Введите код"
          >
          <button
            :disabled="driver.isLoadingParkInvite || !inviteToken.trim()"
            class="mt-3 h-13 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
            type="submit"
          >
            {{ driver.isLoadingParkInvite ? 'Проверяем...' : 'Присоединиться' }}
          </button>
        </form>

        <!-- В парке список чужих парков спрятан: «водитель видит только свой
             парк». Смена — осознанное действие по кнопке ниже. -->
        <button
          v-if="hasPark && canRequest && !showSwitchList"
          class="mt-6 h-12 w-full flex items-center justify-center gap-2 rounded-2xl bg-white/6 text-sm text-slate-300 font-900 transition active:scale-[0.98]"
          type="button"
          @click="showSwitchList = true"
        >
          <span class="i-mdi-swap-horizontal text-5" />
          Сменить таксопарк
        </button>

        <!-- Список парков: вступление (без парка) или смена (в парке, после
             нажатия «Сменить таксопарк»). Пока есть активная заявка — список
             прячем, показываем статус выше. -->
        <section v-if="canRequest && (!hasPark || showSwitchList)" class="mt-6">
          <h2 class="text-xs text-slate-400 font-800 uppercase">
            {{ hasPark ? 'Сменить таксопарк' : 'Доступные парки' }}
          </h2>
          <p v-if="hasPark" class="mt-1 text-xs text-slate-500 leading-4">
            Выберите новый парк и отправьте заявку — после одобрения вы перейдёте в него из текущего.
          </p>

          <p v-if="!displayedParks.length" class="mt-3 text-sm text-slate-500">
            {{ hasPark ? 'Других парков для перехода пока нет.' : 'Пока нет парков, открытых для вступления.' }}
          </p>

          <div v-else class="mt-3 space-y-2">
            <article v-for="park in displayedParks" :key="park.id" class="overflow-hidden rounded-2xl bg-white/5">
              <button
                class="w-full p-4 text-left transition active:bg-white/6"
                type="button"
                @click="toggleDetails(park)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-base font-950">
                      {{ park.name }}
                    </p>
                    <p v-if="park.description" class="line-clamp-2 mt-1 text-xs text-slate-400 leading-4">
                      {{ park.description }}
                    </p>
                  </div>
                  <span class="shrink-0 rounded-full bg-main-500/14 px-3 py-1.5 text-xs text-main-200 font-900">
                    Комиссия {{ commissionLabel(park.commission_rate) }}
                  </span>
                </div>
              </button>

              <!-- Детали парка: описание, телефон, акции, кнопка заявки -->
              <div v-if="expandedParkId === park.id" class="border-t border-white/8 px-4 pb-4 pt-3">
                <div v-if="isLoadingDetails && !parkDetails[park.id]" class="space-y-2">
                  <div v-for="item in 2" :key="item" class="h-10 animate-pulse rounded-xl bg-white/6" />
                </div>

                <template v-else-if="parkDetails[park.id]">
                  <p v-if="parkDetails[park.id].description" class="text-sm text-slate-300 leading-5">
                    {{ parkDetails[park.id].description }}
                  </p>
                  <p v-if="parkDetails[park.id].phone" class="mt-2 text-xs text-slate-400 font-700">
                    <span class="i-mdi-phone mr-1 inline-block align-middle text-3.5" />
                    {{ parkDetails[park.id].phone }}
                  </p>

                  <div v-if="parkDetails[park.id].promotions?.length" class="mt-3 space-y-2">
                    <p class="text-xs text-slate-400 font-800 uppercase">
                      Акции парка
                    </p>
                    <div
                      v-for="(promo, index) in parkDetails[park.id].promotions ?? []"
                      :key="index"
                      class="rounded-xl bg-white/6 px-3 py-2.5"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <p class="min-w-0 text-sm font-900">
                          {{ promo.title }}
                        </p>
                        <span class="shrink-0 text-xs text-main-200 font-900">
                          +{{ Math.floor(promo.reward).toLocaleString('ru-RU') }} бонусов
                        </span>
                      </div>
                      <p v-if="promo.description" class="mt-1 text-xs text-slate-400 leading-4">
                        {{ promo.description }}
                      </p>
                      <p class="mt-1 text-xs text-slate-500 font-700">
                        {{ promo.target_trips }} заказов · до {{ formatDeadline(promo.ends_at) }}
                      </p>
                    </div>
                  </div>

                  <button
                    :disabled="isApplying"
                    class="mt-3 h-12 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
                    type="button"
                    @click="requestPark(park)"
                  >
                    {{ isApplying ? 'Отправляем...' : 'Отправить заявку' }}
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
            {{ isApplying ? 'Отправляем...' : (hasPark ? 'Перейти к партнёрству платформы' : 'Стать партнёром платформы') }}
          </button>
          <p class="mt-2 text-center text-xs text-slate-400 leading-4">
            Работайте напрямую с платформой — комиссия всего 7%
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
        <div class="max-w-sm w-full border border-white/10 rounded-3xl bg-secondary-900 p-5 shadow-2xl">
          <span class="h-12 w-12 flex items-center justify-center rounded-2xl bg-amber-500/14 text-amber-300">
            <span class="i-mdi-swap-horizontal text-7" />
          </span>
          <h3 class="mt-4 text-lg font-950">
            Сменить таксопарк?
          </h3>
          <p class="mt-2 text-sm text-slate-400 leading-5">
            Вы уверены, что хотите уйти из текущего таксопарка и присоединиться к
            «{{ switchTarget.name }}»? Заявку рассмотрит новый парк, а переход
            произойдёт после её одобрения.
          </p>

          <div class="mt-5 flex gap-2">
            <button
              class="h-12 flex-1 rounded-2xl bg-white/8 text-sm font-900 transition active:scale-[0.98]"
              type="button"
              @click="switchTarget = null"
            >
              Нет
            </button>
            <button
              :disabled="isApplying"
              class="h-12 flex-1 rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
              type="button"
              @click="confirmSwitch"
            >
              Да, сменить
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>
