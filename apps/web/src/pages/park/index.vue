<script setup lang="ts">
import type { ParkStatus } from '~/types/park'
import { useRoute as useVueRoute } from 'vue-router'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useParkStore } from '~/stores/park'
import { formatRevenue } from '~/utils/format'

const route = useVueRoute()
const parkStore = useParkStore()

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

const isEditing = ref(false)
const editForm = reactive({ name: '', description: '', bin: '', phone: '', commission_rate_pct: 0 })
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
  editForm.bin = parkStore.park.bin ?? ''
  editForm.phone = parkStore.park.phone ?? ''
  editForm.commission_rate_pct = +(parkStore.park.commission_rate * 100).toFixed(1)
  isEditing.value = true
}

async function saveEdit() {
  const payload = {
    name: editForm.name || undefined,
    description: editForm.description || undefined,
    bin: editForm.bin || undefined,
    phone: editForm.phone || undefined,
    commission_rate: editForm.commission_rate_pct ? +(editForm.commission_rate_pct / 100).toFixed(4) : undefined,
  }
  await parkStore.update(payload)
  isEditing.value = false
}

async function copyToken(token: string) {
  await copy(token)
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

    <!-- Edit modal -->
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
                <span class="text-xs text-white/42 font-900 uppercase">БИН</span>
                <input v-model="editForm.bin" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" type="text">
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Телефон</span>
                <input v-model="editForm.phone" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" type="tel">
              </label>
              <label class="grid gap-1.5">
                <span class="text-xs text-white/42 font-900 uppercase">Комиссия (%)</span>
                <input v-model.number="editForm.commission_rate_pct" class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40" type="number" step="0.1" min="0" max="3">
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
            <p class="mt-2 text-sm text-white/50">
              {{ parkStore.park.bin || parkStore.park.phone || parkStore.park.owner_id }}
            </p>
          </div>

          <span class="rounded-xl px-3 py-2 text-xs font-900" :class="parkStatusClasses[parkStatus]">
            {{ parkStatusLabels[parkStatus] }}
          </span>
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
          <h2 class="text-xl font-950">
            Приглашения
          </h2>
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
          <div v-for="invite in parkStore.invites" :key="invite.id ?? invite.token" class="flex items-center gap-3 rounded-xl bg-black/14 p-3">
            <p class="min-w-0 flex-1 break-all text-sm font-900 font-mono">
              {{ invite.token }}
            </p>
            <div class="flex shrink-0 flex-col items-end gap-1.5">
              <button
                class="h-8 rounded-lg bg-white/8 px-3 text-xs font-900 transition hover:bg-white/14"
                type="button"
                @click="copyToken(invite.token)"
              >
                <span v-if="copied && copiedToken === invite.token" class="text-emerald-300">Скопировано</span>
                <span v-else>Копировать</span>
              </button>
              <p class="text-right text-xs text-white/38">
                {{ invite.used_by ? 'Использовано' : 'Активно' }}
              </p>
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
            <span class="truncate text-sm font-900">{{ driver.user_id }}</span>
            <span class="text-sm" :class="driver.is_online ? 'text-emerald-300' : 'text-white/45'">
              {{ driver.is_online ? 'Онлайн' : 'Офлайн' }}
            </span>
            <span class="text-sm text-white/62">{{ driver.rating.toFixed(1) }}</span>
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
