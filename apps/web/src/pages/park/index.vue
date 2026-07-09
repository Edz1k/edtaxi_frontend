<script setup lang="ts">
import type { ParkChangeRequestPayload, ParkStatus } from '~/types/park'
import { buildParkInviteDeepLink } from '@edtaxi/shared/composables/telegram/parkInvite'
import QRCode from 'qrcode'
import { useRoute as useVueRoute } from 'vue-router'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useToast } from '~/composables/useToast'
import { TG_DRIVER_BOT_USERNAME } from '~/constants/telegram'
import { useParkStore } from '~/stores/park'
import { formatRevenue } from '~/utils/format'

const route = useVueRoute()
const parkStore = useParkStore()
const toast = useToast()

// Присутствие ?park_id= означает, что кабинет открыт «подглядыванием» чужого
// парка (доступно только хардкоженным SuperAdmin — бэкенд игнорирует
// park_id для остальных ролей и вернёт собственный парк или 404). В этом
// режиме скрываем действия редактирования: они всё равно ударят по
// собственному парку вызывающего, а не по просматриваемому.
const viewParkId = computed(() => {
  const raw = route.query.park_id
  return typeof raw === 'string' && raw ? raw : undefined
})
const isPeeking = computed(() => !!viewParkId.value)

// Быстрая правка — только имя/описание/телефон (см. saveEdit).
const isEditing = ref(false)
const editForm = reactive({ name: '', description: '', phone: '' })

// Заявка на изменение БИН/комиссии — отдельная модалка, применяется после
// одобрения администратором.
const isChangeOpen = ref(false)
const changeForm = reactive({ bin: '', commission_rate_pct: 0 })

// QR-приглашение: ссылка на водительский бот, показывается в модалке.
const isQrOpen = ref(false)
const qrToken = ref('')
const qrLink = ref('')
const qrImage = ref('')

const { copy, copied } = useClipboard({ legacy: true })
const copiedToken = ref('')

const parkStatusLabels: Record<ParkStatus, string> = {
  approved: 'Проверен',
  pending: 'Ожидает',
  rejected: 'Отклонён',
}

const parkStatusClasses: Record<ParkStatus, string> = {
  approved: 'bg-emerald-500/12 text-emerald-300',
  pending: 'bg-amber-500/12 text-amber-300',
  rejected: 'bg-red-500/12 text-red-300',
}

const parkStatus = computed<ParkStatus>(() => parkStore.park?.status ?? 'pending')

// Активная заявка на изменение (баннер + блокировка кнопки).
const pendingChange = computed(() =>
  parkStore.changeRequest?.status === 'pending' ? parkStore.changeRequest : null,
)

// Краткое описание запрошенных изменений для баннера «на рассмотрении».
const pendingChangeSummary = computed(() => {
  const req = pendingChange.value
  if (!req)
    return ''
  const parts: string[] = []
  if (req.requested_bin)
    parts.push(`БИН → ${req.requested_bin}`)
  if (req.requested_commission_rate != null)
    parts.push(`Комиссия → ${+(req.requested_commission_rate * 100).toFixed(1)}%`)
  return parts.join(' · ')
})

const commissionPct = computed(() =>
  parkStore.park ? +(parkStore.park.commission_rate * 100).toFixed(1) : 0,
)

definePage({
  meta: {
    authRedirect: '/park/login',
    requiresAuth: true,
    requiredRole: ['park', 'admin', 'superadmin'],
  },
})

useHead({
  title: 'Таксопарк | EdTaxi',
})

onMounted(() => {
  loadParkData().catch(() => {})
})

async function loadParkData() {
  const park = await parkStore.loadPark({ silentNotFound: true, parkId: viewParkId.value })
  if (park)
    await parkStore.loadDashboard()
}

function openEdit() {
  if (!parkStore.park)
    return
  editForm.name = parkStore.park.name
  editForm.description = parkStore.park.description ?? ''
  editForm.phone = parkStore.park.phone ?? ''
  isEditing.value = true
}

async function saveEdit() {
  // Быстрая правка меняет только имя/описание/телефон. БИН и комиссия — через
  // заявку с одобрением админа (openChange/submitChange).
  await parkStore.update({
    name: editForm.name || undefined,
    description: editForm.description || undefined,
    phone: editForm.phone || undefined,
  })
  isEditing.value = false
}

function openChange() {
  if (!parkStore.park)
    return
  changeForm.bin = parkStore.park.bin ?? ''
  changeForm.commission_rate_pct = commissionPct.value
  isChangeOpen.value = true
}

async function submitChange() {
  const bin = changeForm.bin.trim()
  const currentBin = (parkStore.park?.bin ?? '').trim()
  const payload: ParkChangeRequestPayload = {}

  if (bin && bin !== currentBin)
    payload.bin = bin
  if (changeForm.commission_rate_pct !== commissionPct.value)
    payload.commission_rate = +(changeForm.commission_rate_pct / 100).toFixed(4)

  if (payload.bin === undefined && payload.commission_rate === undefined) {
    toast.info('Ничего не изменилось', 'Измените БИН или комиссию перед отправкой заявки.')
    return
  }

  await parkStore.submitChangeRequest(payload)
  isChangeOpen.value = false
  toast.success('Заявка отправлена', 'Изменения применятся после одобрения администратором.')
}

async function openQr(token: string) {
  qrToken.value = token
  qrLink.value = buildParkInviteDeepLink(TG_DRIVER_BOT_USERNAME, token)
  qrImage.value = ''
  isQrOpen.value = true
  try {
    qrImage.value = await QRCode.toDataURL(qrLink.value, {
      width: 320,
      margin: 2,
      color: { dark: '#06142f', light: '#ffffff' },
    })
  }
  catch {
    qrImage.value = ''
  }
}

async function copyInviteLink(token: string) {
  await copy(buildParkInviteDeepLink(TG_DRIVER_BOT_USERNAME, token))
  copiedToken.value = token
}
</script>

<template>
  <WebPageShell
    back-label="Кабинет"
    back-to="/dashboard"
    description="Рабочая зона таксопарка: статус карточки, приглашения водителей и операционные показатели."
    title="Кабинет таксопарка"
  >
    <template v-if="parkStore.park" #actions>
      <span v-if="isPeeking" class="h-11 inline-flex items-center gap-2 rounded-full bg-amber-300/12 px-4 text-sm text-amber-200 font-900">
        <span class="i-mdi-eye-outline text-5" />
        Режим просмотра
      </span>
      <button
        v-if="!isPeeking"
        class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12"
        type="button"
        @click="openEdit()"
      >
        <span class="i-mdi-pencil text-5 text-cyan-200" />
        Редактировать
      </button>
      <button
        :disabled="parkStore.isLoading"
        class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-60"
        type="button"
        @click="loadParkData()"
      >
        <span class="i-mdi-refresh text-5 text-cyan-200" :class="{ 'animate-spin': parkStore.isLoading }" />
        {{ parkStore.isLoading ? 'Обновляем...' : 'Обновить' }}
      </button>
    </template>

    <!-- Quick edit modal: имя / описание / телефон -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
        <div
          v-if="isEditing"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          @click.self="isEditing = false"
        >
          <form
            class="max-w-lg w-full border border-white/10 rounded-3xl bg-#071a38 p-6 shadow-2xl"
            @submit.prevent="saveEdit()"
          >
            <h2 class="text-xl font-950">
              Редактировать парк
            </h2>
            <p class="mt-1 text-sm text-white/50 leading-5">
              Название, описание и телефон. БИН и комиссию можно изменить отдельной заявкой.
            </p>

            <div class="grid mt-5 gap-3">
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Название</span>
                <input v-model="editForm.name" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" type="text">
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Описание</span>
                <textarea v-model="editForm.description" class="w-full border border-white/10 rounded-xl bg-white/8 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" rows="3" />
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Телефон</span>
                <input v-model="editForm.phone" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" type="tel">
              </label>
            </div>

            <div class="mt-5 flex gap-3">
              <button
                :disabled="parkStore.isMutating"
                class="h-11 flex-1 rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
                type="submit"
              >
                {{ parkStore.isMutating ? 'Сохраняем...' : 'Сохранить' }}
              </button>
              <button
                class="h-11 border border-white/12 rounded-2xl bg-white/8 px-5 text-sm font-900 transition hover:bg-white/12"
                type="button"
                @click="isEditing = false"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>

    <!-- Change-request modal: БИН + комиссия (через одобрение админа) -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
        <div
          v-if="isChangeOpen"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          @click.self="isChangeOpen = false"
        >
          <form
            class="max-w-lg w-full border border-white/10 rounded-3xl bg-#071a38 p-6 shadow-2xl"
            @submit.prevent="submitChange()"
          >
            <h2 class="text-xl font-950">
              Изменить БИН и комиссию
            </h2>
            <p class="mt-1 text-sm text-white/50 leading-5">
              Эти поля меняются только через заявку — изменения применятся после одобрения администратором.
            </p>

            <div class="grid mt-5 gap-3">
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">БИН</span>
                <input v-model="changeForm.bin" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" inputmode="numeric" maxlength="12" placeholder="123456789012" type="text">
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Комиссия парка (%)</span>
                <input v-model.number="changeForm.commission_rate_pct" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" max="3" min="0" step="0.1" type="number">
                <span class="text-xs text-white/38">Максимум 3%. Комиссия платформы (7%) добавляется отдельно.</span>
              </label>
            </div>

            <div class="mt-5 flex gap-3">
              <button
                :disabled="parkStore.isMutating"
                class="h-11 flex-1 rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
                type="submit"
              >
                {{ parkStore.isMutating ? 'Отправляем...' : 'Отправить заявку' }}
              </button>
              <button
                class="h-11 border border-white/12 rounded-2xl bg-white/8 px-5 text-sm font-900 transition hover:bg-white/12"
                type="button"
                @click="isChangeOpen = false"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>

    <!-- QR-приглашение водителя -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
        <div
          v-if="isQrOpen"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          @click.self="isQrOpen = false"
        >
          <div class="max-w-sm w-full border border-white/10 rounded-3xl bg-#071a38 p-6 text-center shadow-2xl">
            <h2 class="text-xl font-950">
              Пригласить водителя
            </h2>
            <p class="mt-1 text-sm text-white/55 leading-5">
              Водитель сканирует QR — приложение предложит вступить в парк (или сменить текущий).
            </p>

            <div class="mt-5 flex justify-center">
              <div class="border border-white/10 rounded-2xl bg-white p-3">
                <img v-if="qrImage" alt="QR-приглашение" class="h-56 w-56" :src="qrImage">
                <div v-else class="h-56 w-56 flex items-center justify-center text-sm text-#06142f/60">
                  Генерируем...
                </div>
              </div>
            </div>

            <p class="mt-4 break-all text-xs text-white/45 font-mono">
              {{ qrLink }}
            </p>

            <div class="mt-4 flex gap-3">
              <button
                class="h-11 flex-1 rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition hover:bg-cyan-200"
                type="button"
                @click="copyInviteLink(qrToken)"
              >
                {{ copied && copiedToken === qrToken ? 'Скопировано' : 'Копировать ссылку' }}
              </button>
              <button
                class="h-11 border border-white/12 rounded-2xl bg-white/8 px-5 text-sm font-900 transition hover:bg-white/12"
                type="button"
                @click="isQrOpen = false"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <section v-if="parkStore.isLoading && !parkStore.park" class="mt-5 border border-white/10 rounded-3xl bg-white/8 p-5 text-sm text-white/50 backdrop-blur">
      Загружаем кабинет таксопарка...
    </section>

    <section v-else-if="!parkStore.park" class="mt-5 border border-amber-300/18 rounded-3xl bg-amber-300/8 p-6 backdrop-blur">
      <div class="max-w-2xl flex flex-col gap-4">
        <span class="h-13 w-13 flex items-center justify-center rounded-2xl bg-amber-300/12 text-amber-200">
          <span class="i-mdi-office-building-alert text-7" />
        </span>
        <div>
          <h2 class="text-2xl font-950">
            Таксопарк еще не привязан
          </h2>
          <p class="mt-2 text-sm text-white/60 leading-6">
            Кабинет открывается после того, как менеджер проверит заявку и создаст таксопарк. Новую заявку можно оставить на публичной странице регистрации.
          </p>
        </div>
        <RouterLink
          class="h-11 w-fit inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 text-sm text-#06142f font-900"
          to="/park/register"
        >
          Подать заявку
          <span class="i-mdi-arrow-right text-5" />
        </RouterLink>
      </div>
    </section>

    <div v-else class="grid mt-6 gap-5">
      <section class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs text-white/42 font-900 uppercase">
              Парк
            </p>
            <h2 class="mt-1 text-2xl font-950">
              {{ parkStore.park.name }}
            </h2>
            <p v-if="parkStore.park.description" class="mt-1 text-sm text-white/62 leading-5">
              {{ parkStore.park.description }}
            </p>
          </div>

          <span class="rounded-xl px-3 py-2 text-xs font-900" :class="parkStatusClasses[parkStatus]">
            {{ parkStatusLabels[parkStatus] }}
          </span>
        </div>

        <!-- Реквизиты: БИН / телефон / комиссия -->
        <div class="grid mt-4 gap-3 sm:grid-cols-3">
          <div class="rounded-2xl bg-black/14 px-4 py-3">
            <p class="text-xs text-white/42 font-900 uppercase">
              БИН
            </p>
            <p class="mt-0.5 text-sm font-900">
              {{ parkStore.park.bin || '—' }}
            </p>
          </div>
          <div class="rounded-2xl bg-black/14 px-4 py-3">
            <p class="text-xs text-white/42 font-900 uppercase">
              Телефон
            </p>
            <p class="mt-0.5 text-sm font-900">
              {{ parkStore.park.phone || '—' }}
            </p>
          </div>
          <div class="rounded-2xl bg-black/14 px-4 py-3">
            <p class="text-xs text-white/42 font-900 uppercase">
              Комиссия парка
            </p>
            <p class="mt-0.5 text-sm font-900">
              {{ commissionPct }}%
            </p>
          </div>
        </div>

        <!-- Заявка на изменение БИН/комиссии -->
        <div v-if="!isPeeking" class="mt-4">
          <div v-if="pendingChange" class="flex flex-wrap items-center justify-between gap-3 border border-amber-300/18 rounded-2xl bg-amber-300/8 p-4">
            <div>
              <p class="text-xs text-amber-300/80 font-900 uppercase">
                Заявка на рассмотрении
              </p>
              <p class="mt-1 text-sm text-white/70 leading-5">
                {{ pendingChangeSummary }}
              </p>
            </div>
            <span class="i-mdi-clock-outline text-6 text-amber-300" />
          </div>
          <button
            v-else
            class="h-10 inline-flex items-center gap-2 border border-white/12 rounded-xl bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12"
            type="button"
            @click="openChange()"
          >
            <span class="i-mdi-file-document-edit-outline text-4.5 text-cyan-200" />
            Изменить БИН и комиссию
          </button>
        </div>

        <div v-if="parkStatus === 'rejected'" class="mt-4 border border-red-400/18 rounded-2xl bg-red-500/8 p-4">
          <p class="text-xs text-red-300/80 font-900 uppercase">
            Заявка отклонена
          </p>
          <p class="mt-1 text-sm text-white/70 leading-5">
            {{ parkStore.park.rejection_reason || 'Причина не указана. Свяжитесь с поддержкой или подайте заявку повторно.' }}
          </p>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-3">
        <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
          <p class="text-xs text-white/42 font-900 uppercase">
            Водители
          </p>
          <p class="mt-2 text-3xl font-950">
            {{ parkStore.analytics?.driver_count ?? 0 }}
          </p>
        </div>
        <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
          <p class="text-xs text-white/42 font-900 uppercase">
            Поездки
          </p>
          <p class="mt-2 text-3xl font-950">
            {{ parkStore.analytics?.trip_count ?? 0 }}
          </p>
        </div>
        <div class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
          <p class="text-xs text-white/42 font-900 uppercase">
            Выручка
          </p>
          <p class="mt-2 text-3xl font-950">
            {{ formatRevenue(parkStore.analytics?.total_revenue ?? 0) }}
          </p>
        </div>
      </section>

      <section class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-950">
              Приглашения
            </h2>
            <p class="mt-1 text-sm text-white/55">
              Создайте ссылку-приглашение и покажите водителю QR — он вступит в парк в один тап.
            </p>
          </div>
          <button
            v-if="!isPeeking"
            :disabled="parkStore.isMutating"
            class="h-10 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 disabled:opacity-60"
            type="button"
            @click="parkStore.createInvite()"
          >
            Создать
          </button>
        </div>

        <div class="grid mt-4 gap-2">
          <p v-if="!parkStore.invites.length" class="text-sm text-white/50">
            Приглашений нет.
          </p>
          <div v-for="invite in parkStore.invites" :key="invite.id ?? invite.token" class="flex flex-wrap items-center gap-3 rounded-xl bg-black/14 p-3">
            <p class="min-w-0 flex-1 break-all text-sm font-900 font-mono">
              {{ invite.token }}
            </p>
            <span class="text-xs text-white/38">
              {{ invite.used_by ? 'Использовано' : 'Активно' }}
            </span>
            <div class="flex shrink-0 gap-1.5">
              <button
                class="h-8 inline-flex items-center gap-1 rounded-lg bg-white/8 px-3 text-xs font-900 transition hover:bg-white/14"
                type="button"
                @click="copyInviteLink(invite.token)"
              >
                <span v-if="copied && copiedToken === invite.token" class="text-emerald-300">Скопировано</span>
                <template v-else>
                  <span class="i-mdi-link-variant text-3.5" />
                  Ссылка
                </template>
              </button>
              <button
                class="h-8 inline-flex items-center gap-1 rounded-lg bg-cyan-300/14 px-3 text-xs text-cyan-200 font-900 transition hover:bg-cyan-300/22"
                type="button"
                @click="openQr(invite.token)"
              >
                <span class="i-mdi-qrcode text-3.5" />
                QR
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <h2 class="text-xl font-950">
          Водители
        </h2>

        <div class="mt-4 overflow-hidden rounded-2xl bg-black/14">
          <div v-if="!parkStore.drivers.length" class="p-4 text-sm text-white/50">
            Водителей нет.
          </div>
          <div
            v-for="driver in parkStore.drivers"
            v-else
            :key="driver.id"
            class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_90px_100px_120px] md:items-center last:border-b-0"
          >
            <!-- Имя вместо UUID; клик открывает кабинет водителя -->
            <div class="min-w-0">
              <RouterLink
                class="block truncate text-sm text-cyan-200 font-900 hover:underline"
                :to="`/drivers/${driver.user_id}`"
              >
                {{ driver.name || 'Без имени' }}
              </RouterLink>
              <p class="mt-0.5 truncate text-xs text-white/42">
                {{ driver.phone || driver.user_id }}
              </p>
            </div>
            <span class="text-sm" :class="driver.is_online ? 'text-emerald-300' : 'text-white/45'">
              {{ driver.is_online ? 'Онлайн' : 'Офлайн' }}
            </span>
            <span class="text-sm text-white/62">
              <span class="i-mdi-star mr-0.5 inline-block align-middle text-3.5 text-amber-300" />
              {{ driver.rating.toFixed(1) }} · {{ driver.total_trips }}
            </span>
            <button
              v-if="!isPeeking"
              :disabled="parkStore.isMutating"
              class="h-9 rounded-xl bg-red-500/12 px-3 text-sm text-red-300 font-900 disabled:opacity-50"
              type="button"
              @click="parkStore.removeDriver(driver.id)"
            >
              Удалить
            </button>
          </div>
        </div>
      </section>

      <section v-if="!isPeeking" class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs text-white/42 font-900 uppercase">
              Финансы
            </p>
            <h2 class="mt-1 text-xl font-950">
              Кошелёк парка
            </h2>
            <p class="mt-1 text-sm text-white/55">
              Баланс, заявки на вывод средств и их статусы.
            </p>
          </div>
          <RouterLink
            class="h-10 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 transition hover:bg-cyan-200"
            to="/park/wallet"
          >
            <span class="i-mdi-wallet-outline text-4.5" />
            Открыть кошелёк
          </RouterLink>
        </div>
      </section>

      <section v-if="!isPeeking" class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs text-white/42 font-900 uppercase">
              Бонусы
            </p>
            <h2 class="mt-1 text-xl font-950">
              Акции парка
            </h2>
            <p class="mt-1 text-sm text-white/55">
              Акции «N поездок → X бонусов» для ваших водителей с рассылкой в Telegram.
            </p>
          </div>
          <RouterLink
            class="h-10 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 transition hover:bg-cyan-200"
            to="/park/promotions"
          >
            <span class="i-mdi-gift-outline text-4.5" />
            Открыть акции
          </RouterLink>
        </div>
      </section>

      <section v-if="!isPeeking" class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs text-white/42 font-900 uppercase">
              Найм
            </p>
            <h2 class="mt-1 text-xl font-950">
              Заявки водителей
            </h2>
            <p class="mt-1 text-sm text-white/55">
              Водители, которые хотят вступить в ваш парк: принимайте или отклоняйте.
            </p>
          </div>
          <RouterLink
            class="h-10 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 transition hover:bg-cyan-200"
            to="/park/requests"
          >
            <span class="i-mdi-account-plus-outline text-4.5" />
            Открыть заявки
          </RouterLink>
        </div>
      </section>

      <section v-if="!isPeeking" class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs text-white/42 font-900 uppercase">
              Чат
            </p>
            <h2 class="mt-1 text-xl font-950">
              Сообщения водителей
            </h2>
          </div>
          <RouterLink
            class="h-10 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 transition hover:bg-cyan-200"
            to="/park/chat"
          >
            <span class="i-mdi-chat-outline text-4.5" />
            Открыть чат
          </RouterLink>
        </div>
      </section>
    </div>
  </WebPageShell>
</template>
