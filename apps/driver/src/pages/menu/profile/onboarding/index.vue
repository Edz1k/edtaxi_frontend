<script setup lang="ts">
import type { VerificationStatus } from '~/types/driver'
import { useAutoRefresh } from '@edtaxi/shared/composables/useAutoRefresh'
import { useNow } from '@vueuse/core'
import { useDriverOnboardingStore } from '~/stores/driverOnboarding'
import { dailyCheckState, validUntilLabel } from '~/utils/dailyCheck'

const driver = useDriverOnboardingStore()

definePage({
  meta: {
    authRedirect: '/login',
    layout: 'driver',
    requiresAuth: true,
    requiredRole: 'driver',
    backTo: '/menu/profile',
    screenSubtitle: 'Назад в профиль',
    screenTitle: 'Фотоконтроль',
  },
})

useHead({
  title: 'Фотоконтроль | Telegram Taxi Driver',
})

onMounted(async () => {
  await driver.loadVerification().catch(() => {})
})

// Статусы проверок обновляются сами (возврат на экран + фоновый поллинг):
// одобрение поддержки видно сразу, без ручного перезахода на страницу.
useAutoRefresh(() => driver.loadVerification(), { intervalMs: 12_000 })

type ItemStatus = 'missing' | 'ok' | 'pending' | 'rejected'

// Подблок пункта фотоконтроля: отдельный вердикт поддержки («Селфи ✓ · Документ ✗»).
interface ItemBlock {
  label: string
  status: ItemStatus
}

interface OnboardingItem {
  label: string
  description: string
  icon: string
  to: string
  status: ItemStatus
  blocks?: ItemBlock[]
  // Причина отказа от поддержки — что именно исправить.
  reason?: null | string
  // Имя, под которым водителя показывают пассажирам (TODO п.27).
  note?: null | string
}

function checkToStatus(check?: VerificationStatus | string): ItemStatus {
  if (check === 'approved')
    return 'ok'
  if (check === 'rejected')
    return 'rejected'
  if (check === 'pending')
    return 'pending'
  return 'missing'
}

const faceStatus = computed<ItemStatus>(() => {
  const v = driver.verification
  if (!v)
    return 'missing'
  if (v.face_status === 'approved')
    return 'ok'
  if (v.face_status === 'pending')
    return 'pending'
  if (v.face_status === 'rejected')
    return 'rejected'
  return 'missing'
})

// Имя с удостоверения, под которым водителя видят пассажиры (TODO п.27):
// показываем только когда лицо одобрено и поддержка заполнила имя.
const verifiedName = computed<null | string>(() => {
  const v = driver.verification
  if (!v || v.face_status !== 'approved')
    return null
  const name = `${v.verified_first_name ?? ''} ${v.verified_last_name ?? ''}`.trim()
  return name ? `Пассажиры видят вас как: ${name}` : null
})

// «Основная» машина для фотоконтроля: активная, иначе первая.
const mainVehicle = computed(() => {
  const vehicles = driver.verification?.vehicles ?? []
  return vehicles.find(v => v.is_active) ?? vehicles[0] ?? null
})

const vehiclePhotosStatus = computed<ItemStatus>(() => {
  const v = mainVehicle.value
  if (!v)
    return 'missing'
  // У одобренной машины блоки могли остаться pending (решение старым флоу) —
  // показываем итог, чтобы не пугать водителя «непройденным» блоком.
  if (v.verification_status === 'approved')
    return 'ok'
  return checkToStatus(v.photos_check ?? v.verification_status)
})

const vehicleDocsStatus = computed<ItemStatus>(() => {
  const v = mainVehicle.value
  if (!v)
    return 'missing'
  if (v.verification_status === 'approved')
    return 'ok'
  return checkToStatus(v.docs_check ?? v.verification_status)
})

// Срок фотоконтроля истекает по часам, поэтому состояние считается от тикера,
// а не только от серверного флага: иначе экран показывал бы «Пройдено» до
// следующего запроса, хотя проверка уже сгорела.
const now = useNow({ interval: 15_000 })
const dailyStatus = computed<ItemStatus>(() => {
  const state = dailyCheckState(driver.verification, now.value.getTime())
  if (state === 'valid')
    return 'ok'
  if (state === 'pending' || state === 'rejected')
    return state
  // expired (заявку не рассмотрели вовремя) и истёкший срок одинаково означают
  // «нужна новая проверка».
  return 'missing'
})

// «Действует до 19:40» — водителю важно знать, когда идти сниматься заново.
const dailyValidUntilLabel = computed(() =>
  dailyStatus.value === 'ok'
    ? validUntilLabel(driver.verification?.daily_check_valid_until)
    : '',
)

const items = computed<OnboardingItem[]>(() => {
  const v = driver.verification
  const vehicle = mainVehicle.value
  const latestDaily = v?.latest_daily_check

  return [
    {
      label: 'Идентификация личности',
      description: statusDescription(faceStatus.value, 'Селфи и удостоверение для проверки'),
      icon: 'i-mdi-face-recognition',
      to: '/menu/profile/onboarding/face-photo',
      status: faceStatus.value,
      blocks: v && v.face_status !== 'none'
        ? [
            { label: 'Селфи', status: checkToStatus(v.face_selfie_check) },
            { label: 'Удостоверение', status: checkToStatus(v.face_doc_check) },
          ]
        : undefined,
      reason: faceStatus.value === 'rejected' ? v?.face_rejection_reason : null,
      note: verifiedName.value,
    },
    {
      label: 'Фотоконтроль машины',
      description: statusDescription(vehiclePhotosStatus.value, 'Фото кузова и салона'),
      icon: 'i-mdi-car-outline',
      // section=car — внутри только фото машины, без документов.
      to: '/menu/profile/onboarding/vehicle-docs?section=car',
      status: vehiclePhotosStatus.value,
      reason: vehiclePhotosStatus.value === 'rejected' ? vehicle?.rejection_reason : null,
    },
    {
      label: 'Фотоконтроль документов',
      description: statusDescription(vehicleDocsStatus.value, 'Техпаспорт, VIN и страховка'),
      icon: 'i-mdi-card-account-details-outline',
      // section=docs — внутри только документы (техпаспорт/VIN/страховка).
      to: '/menu/profile/onboarding/vehicle-docs?section=docs',
      status: vehicleDocsStatus.value,
      reason: vehicleDocsStatus.value === 'rejected' ? vehicle?.rejection_reason : null,
    },
    {
      label: 'Ежедневная проверка',
      description: statusDescription(dailyStatus.value, 'Селфи и фото машины перед сменой'),
      icon: 'i-mdi-calendar-check',
      to: '/menu/profile/onboarding/daily-check',
      status: dailyStatus.value,
      blocks: latestDaily && dailyStatus.value !== 'missing' && !v?.daily_check_valid
        ? [
            { label: 'Селфи', status: checkToStatus(latestDaily.selfie_check) },
            { label: 'Машина', status: checkToStatus(latestDaily.vehicle_check) },
          ]
        : undefined,
      reason: dailyStatus.value === 'rejected' ? latestDaily?.rejection_reason : null,
    },
  ]
})

// --- Общий статус для экрана-героя сверху -------------------------------
// approved — всё пройдено; action — что-то не загружено/отклонено (нужно
// действие водителя); pending — всё загружено, ждём проверки поддержкой.
const overall = computed<'action' | 'approved' | 'pending'>(() => {
  const list = items.value
  if (list.every(i => i.status === 'ok'))
    return 'approved'
  if (list.some(i => i.status === 'rejected' || i.status === 'missing'))
    return 'action'
  return 'pending'
})

const hero = computed(() => {
  if (overall.value === 'approved') {
    return {
      icon: 'i-mdi-shield-check',
      text: 'Все проверки успешно пройдены — можно выходить на линию.',
      title: 'Верификация пройдена',
      tone: 'emerald' as const,
    }
  }
  return {
    icon: 'i-mdi-shield-sync',
    text: 'Мы проверяем загруженные данные. Обычно это занимает недолго — сообщим о результате.',
    title: 'Данные на проверке',
    tone: 'amber' as const,
  }
})

// «Следующая проверка» — про ежедневный фотоконтроль (он повторяется каждую смену).
const nextCheckLine = computed(() => {
  if (dailyStatus.value === 'ok') {
    return dailyValidUntilLabel.value
      ? `Ежедневный фотоконтроль пройден. Действует до ${dailyValidUntilLabel.value}.`
      : 'Ежедневный фотоконтроль пройден.'
  }
  if (dailyStatus.value === 'pending')
    return 'Ежедневный фотоконтроль на проверке.'
  if (driver.verification?.latest_daily_check?.status === 'expired')
    return 'Заявку на фотоконтроль не успели рассмотреть — отправьте фото заново.'
  return 'Проходите ежедневный фотоконтроль перед каждой сменой.'
})

function statusDescription(status: ItemStatus, fallback: string) {
  if (status === 'ok')
    return 'Пройдено'
  if (status === 'pending')
    return 'На проверке'
  if (status === 'rejected')
    return 'Не пройдено'
  return fallback
}

function statusIcon(status: ItemStatus) {
  if (status === 'ok')
    return 'i-mdi-check-circle'
  if (status === 'pending')
    return 'i-mdi-clock-outline'
  if (status === 'rejected')
    return 'i-mdi-close-circle'
  return 'i-mdi-chevron-right'
}

function statusColor(status: ItemStatus) {
  if (status === 'ok')
    return 'text-emerald-400'
  if (status === 'pending')
    return 'text-amber-400'
  if (status === 'rejected')
    return 'text-red-400'
  return 'text-slate-500'
}

function itemBg(status: ItemStatus) {
  if (status === 'ok')
    return 'bg-emerald-500/10'
  if (status === 'rejected')
    return 'bg-red-500/10'
  return 'bg-white/5'
}

function iconBg(status: ItemStatus) {
  if (status === 'ok')
    return 'bg-emerald-500/16 text-emerald-300'
  if (status === 'rejected')
    return 'bg-red-500/16 text-red-300'
  if (status === 'pending')
    return 'bg-amber-500/16 text-amber-300'
  return 'bg-white/8 text-main-200'
}

function blockBadge(status: ItemStatus) {
  if (status === 'ok')
    return 'bg-emerald-500/14 text-emerald-300'
  if (status === 'rejected')
    return 'bg-red-500/14 text-red-300'
  if (status === 'pending')
    return 'bg-amber-500/14 text-amber-300'
  return 'bg-white/8 text-slate-400'
}

function blockIcon(status: ItemStatus) {
  if (status === 'ok')
    return 'i-mdi-check'
  if (status === 'rejected')
    return 'i-mdi-close'
  return 'i-mdi-clock-outline'
}
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+6.5rem)]">
    <section class="mx-auto max-w-sm">
      <header>
        <p class="text-xs text-main-300 font-900 uppercase">
          Водитель
        </p>
        <h1 class="mt-1 text-3xl font-950">
          Фотоконтроль
        </h1>
        <p class="mt-2 text-sm text-slate-400 leading-5">
          {{ overall === 'action'
            ? 'Пройдите все проверки, чтобы выйти на линию. Если проверка не пройдена — внутри написано, что исправить.'
            : 'Статусы ваших проверок — ниже.' }}
        </p>
      </header>

      <div v-if="driver.isLoadingVerification" class="mt-8 flex items-center gap-3 text-sm text-slate-400">
        <span class="i-mdi-loading animate-spin text-5" />
        Загружаем статус...
      </div>

      <template v-else>
        <!-- Экран-статус: показываем, когда всё загружено (на проверке) или пройдено -->
        <div
          v-if="overall !== 'action'"
          class="mt-6 rounded-3xl p-5"
          :class="hero.tone === 'emerald' ? 'bg-emerald-500/10' : 'bg-amber-500/10'"
        >
          <div class="flex items-center gap-4">
            <span
              class="h-14 w-14 flex shrink-0 items-center justify-center rounded-2xl"
              :class="hero.tone === 'emerald' ? 'bg-emerald-500/16 text-emerald-300' : 'bg-amber-500/16 text-amber-300'"
            >
              <span :class="hero.icon" class="text-8" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <h2 class="text-xl font-950" :class="hero.tone === 'emerald' ? 'text-emerald-100' : 'text-amber-100'">
                {{ hero.title }}
              </h2>
              <p class="mt-0.5 text-sm leading-5" :class="hero.tone === 'emerald' ? 'text-emerald-300/85' : 'text-amber-300/85'">
                {{ hero.text }}
              </p>
            </div>
          </div>
          <p class="mt-4 flex items-center gap-2 rounded-2xl bg-black/20 px-3.5 py-2.5 text-xs text-slate-300 font-700 leading-5">
            <span class="i-mdi-calendar-clock shrink-0 text-4.5 text-main-300" aria-hidden="true" />
            {{ nextCheckLine }}
          </p>
        </div>

        <nav class="mt-6 space-y-3">
          <RouterLink
            v-for="item in items"
            :key="item.label"
            :to="item.to"
            class="block rounded-3xl px-4 py-4 text-white transition active:scale-[0.98]"
            :class="itemBg(item.status)"
          >
            <span class="flex items-center gap-4">
              <span
                class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl"
                :class="iconBg(item.status)"
              >
                <span :class="item.icon" class="text-7" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="block text-lg font-900">
                  {{ item.label }}
                </span>
                <span class="mt-0.5 block truncate text-xs font-600" :class="statusColor(item.status)">
                  {{ item.description }}
                </span>
              </span>

              <span class="text-7" :class="[statusIcon(item.status), statusColor(item.status)]" />
            </span>

            <!-- Пер-блочные вердикты поддержки: видно, какой именно блок не прошёл -->
            <span v-if="item.blocks" class="mt-3 flex flex-wrap gap-1.5">
              <span
                v-for="block in item.blocks"
                :key="block.label"
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-800"
                :class="blockBadge(block.status)"
              >
                <span :class="blockIcon(block.status)" class="text-3.5" />
                {{ block.label }}
              </span>
            </span>

            <!-- Причина отказа от поддержки -->
            <span
              v-if="item.reason"
              class="mt-2 block rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 leading-5"
            >
              {{ item.reason }}
            </span>

            <!-- Имя для пассажиров (verified с удостоверения) -->
            <span
              v-if="item.note"
              class="mt-2 block rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 leading-5"
            >
              {{ item.note }}
            </span>
          </RouterLink>
        </nav>
      </template>
    </section>
  </main>
</template>
