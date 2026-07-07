<script setup lang="ts">
import { openExternalLink } from '@edtaxi/shared/composables/auth/telegram'
import { useTripsStore } from '~/stores/trips'

const trips = useTripsStore()

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'passenger',
    requiresAuth: true,
    requiredRole: 'passenger',
    screenSubtitle: 'Назад в меню',
    screenTitle: 'Безопасность',
  },
})

useHead({
  title: 'Безопасность | EdTaxi',
})

// Если меню открыли раньше карты, активная поездка могла ещё не подтянуться —
// без неё «Отправить маршрут» не соберёт текст.
onMounted(async () => {
  if (!trips.activeTrip)
    await trips.restoreActiveTrip().catch(() => {})
})

// Маршрут можно отправить и до заказа: пассажир делится планом поездки,
// пока едет в уже выбранную точку (например, заказал с другого устройства).
const plannedRoute = computed(() => {
  const from = trips.pickupPlace?.address || trips.pickup
  const to = trips.destinationPlace?.address || trips.destination
  return from && to ? { from, to } : null
})

const canShareRoute = computed(() => trips.hasActiveTrip || Boolean(plannedRoute.value))

// Экстренный вызов: Telegram-вебвью блокирует ЛЮБУЮ tel:-навигацию внутри
// мини-аппа (и <a href>, и location.href) — поэтому открываем во внешнем
// браузере крошечную страницу /call-112.html с нашего же домена: она сама
// набирает 112, а если браузер требует явный тап — там большая кнопка.
function call112() {
  openExternalLink(`${window.location.origin}/call-112.html`)
}

function shareRoute() {
  const trip = trips.hasActiveTrip ? trips.activeTrip : null
  const lines: string[] = ['Я еду на такси EdTaxi.']

  if (trip) {
    lines.push(`Маршрут: ${trip.pickup_address} → ${trip.dropoff_address}`)

    const driver = trip.driver
    if (driver?.name)
      lines.push(`Водитель: ${driver.name}`)
    if (driver?.vehicle) {
      const v = driver.vehicle
      lines.push(`Автомобиль: ${[v.color, v.make, v.model].filter(Boolean).join(' ')}, гос. номер ${v.plate_number}`)
    }

    lines.push(`Точка назначения на карте: https://maps.google.com/?q=${trip.dropoff_lat},${trip.dropoff_lng}`)
  }
  else if (plannedRoute.value) {
    lines.push(`Маршрут: ${plannedRoute.value.from} → ${plannedRoute.value.to}`)
  }

  openExternalLink(`https://t.me/share/url?url=&text=${encodeURIComponent(lines.join('\n'))}`)
}

const safetyChecks = [
  {
    icon: 'i-mdi-card-account-details-outline',
    text: 'Удостоверение личности и водительские права проверяются вручную до первого заказа',
  },
  {
    icon: 'i-mdi-car-info',
    text: 'Техпаспорт, фото автомобиля и гос. номер сверяются с данными в заказе',
  },
  {
    icon: 'i-mdi-face-recognition',
    text: 'Фото водителя подтверждается при выходе на линию — за рулём именно тот, кто в профиле',
  },
  {
    icon: 'i-mdi-history',
    text: 'Каждая поездка сохраняется в истории: маршрут, водитель и автомобиль всегда можно поднять',
  },
]
</script>

<template>
  <main class="tg-safe-x tg-menu-inner-safe h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] text-white">
    <section class="mx-auto max-w-sm">
      <!-- Экстренный вызов -->
      <section class="border border-red-500/25 rounded-3xl bg-red-500/8 p-5">
        <div class="flex items-center gap-3">
          <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
            <span class="i-mdi-phone-alert text-7" />
          </span>
          <div class="min-w-0">
            <h2 class="text-lg font-950">
              Экстренная помощь
            </h2>
            <p class="text-xs text-slate-400 font-700">
              Единый номер спасения — звонок бесплатный
            </p>
          </div>
        </div>

        <!-- В Telegram-вебвью клик по <a href="tel:"> нередко «проглатывается»
             без перехода — принудительно уводим на tel: через location. -->
        <button
          class="mt-4 h-14 w-full flex items-center justify-center gap-2 rounded-2xl bg-red-500 text-base font-950 transition active:scale-[0.98]"
          type="button"
          @click="call112"
        >
          <span class="i-mdi-phone text-5.5" />
          Позвонить 112
        </button>
      </section>

      <!-- Отправить маршрут -->
      <section class="mt-4 rounded-3xl bg-white/5 p-5">
        <div class="flex items-center gap-3">
          <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-white/8 text-main-200">
            <span class="i-mdi-map-marker-path text-7" />
          </span>
          <div class="min-w-0">
            <h2 class="text-lg font-950">
              Отправить маршрут
            </h2>
            <p class="text-xs text-slate-400 font-700">
              Близкие увидят, куда и с кем вы едете
            </p>
          </div>
        </div>

        <button
          :disabled="!canShareRoute"
          class="mt-4 h-13 w-full flex items-center justify-center gap-2 rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-50"
          type="button"
          @click="shareRoute"
        >
          <span class="i-mdi-share-variant text-5" />
          Поделиться в Telegram
        </button>

        <p v-if="!canShareRoute" class="mt-3 text-xs text-slate-500 leading-4">
          Кнопка станет активной, когда вы построите маршрут или закажете поездку.
        </p>
        <p v-else-if="trips.hasActiveTrip" class="mt-3 text-xs text-slate-500 leading-4">
          В сообщение попадут адреса поездки, имя водителя, автомобиль и гос. номер.
        </p>
      </section>

      <!-- Проверенные водители -->
      <section class="mt-4 rounded-3xl bg-white/5 p-5">
        <div class="flex items-center gap-3">
          <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-300">
            <span class="i-mdi-shield-check text-7" />
          </span>
          <div class="min-w-0">
            <h2 class="text-lg font-950">
              Проверенные водители
            </h2>
            <p class="text-xs text-slate-400 font-700">
              К заказам допускаем только после проверки документов
            </p>
          </div>
        </div>

        <ul class="mt-4 space-y-3">
          <li v-for="check in safetyChecks" :key="check.icon" class="flex items-start gap-3">
            <span :class="check.icon" class="mt-0.5 shrink-0 text-5 text-emerald-300/80" />
            <p class="text-sm text-slate-300 leading-5">
              {{ check.text }}
            </p>
          </li>
        </ul>
      </section>

      <!-- Что-то пошло не так -->
      <RouterLink
        class="mt-4 flex items-center gap-4 rounded-3xl bg-white/5 px-4 py-4 transition active:scale-[0.98]"
        to="/menu/support"
      >
        <span class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-white/8 text-main-200">
          <span class="i-mdi-headset text-7" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-base font-900">
            Что-то пошло не так?
          </span>
          <span class="mt-0.5 block text-xs text-slate-400 font-600">
            Напишите в поддержку — разберёмся и поможем
          </span>
        </span>
        <span class="i-mdi-chevron-right text-7 text-slate-500" />
      </RouterLink>
    </section>
  </main>
</template>
