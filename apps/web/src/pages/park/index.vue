<script setup lang="ts">
import type { ParkChangeRequestPayload, TaxiParkUpdatePayload } from '~/types/park'
import { useRoute as useVueRoute } from 'vue-router'
import WebPageShell from '~/components/app/WebPageShell.vue'
import ParkAnalyticsSection from '~/components/park/ParkAnalyticsSection.vue'
import ParkChangeRequestModal from '~/components/park/ParkChangeRequestModal.vue'
import ParkDriversSection from '~/components/park/ParkDriversSection.vue'
import ParkEditModal from '~/components/park/ParkEditModal.vue'
import ParkInviteSection from '~/components/park/ParkInviteSection.vue'
import ParkProfileCard from '~/components/park/ParkProfileCard.vue'
import { useToast } from '~/composables/useToast'
import { useParkStore } from '~/stores/park'

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

const isEditing = ref(false)
const isChangeOpen = ref(false)

// Активная заявка на изменение БИН/комиссии (баннер + блокировка кнопки).
const pendingChange = computed(() =>
  parkStore.changeRequest?.status === 'pending' ? parkStore.changeRequest : null,
)

definePage({
  meta: {
    authRedirect: '/park/login',
    requiresAuth: true,
    layout: 'park',
    requiredRole: ['park', 'admin', 'superadmin'],
  },
})

useHead({
  title: 'Таксопарк | Telegram Taxi',
})

onMounted(() => {
  loadParkData().catch(() => {})
})

async function loadParkData() {
  const park = await parkStore.loadPark({ silentNotFound: true, parkId: viewParkId.value })
  if (park)
    await parkStore.loadDashboard()
}

async function saveEdit(payload: TaxiParkUpdatePayload) {
  await parkStore.update(payload)
  isEditing.value = false
}

async function submitChange(payload: ParkChangeRequestPayload) {
  if (payload.bin === undefined && payload.commission_rate === undefined) {
    toast.info('Ничего не изменилось', 'Измените БИН или комиссию перед отправкой заявки.')
    return
  }

  await parkStore.submitChangeRequest(payload)
  isChangeOpen.value = false
  toast.success('Заявка отправлена', 'Изменения применятся после одобрения администратором.')
}

// Перевыпуск необратим: розданные QR перестают работать сразу, поэтому
// спрашиваем подтверждение.
async function rotateInvite() {
  // eslint-disable-next-line no-alert
  if (!window.confirm('Старая ссылка и QR перестанут работать. Выпустить новую?'))
    return
  const invite = await parkStore.rotateInvite()
  if (invite)
    toast.success('Ссылка обновлена', 'Раздайте водителям новый QR.')
}
</script>

<template>
  <WebPageShell
    embedded
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
        @click="isEditing = true"
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

    <ParkEditModal
      v-model="isEditing"
      :park="parkStore.park"
      :pending="parkStore.isMutating"
      @submit="saveEdit"
    />

    <ParkChangeRequestModal
      v-model="isChangeOpen"
      :park="parkStore.park"
      :pending="parkStore.isMutating"
      @submit="submitChange"
    />

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
      <ParkProfileCard
        :is-peeking="isPeeking"
        :park="parkStore.park"
        :pending-change="pendingChange"
        @open-change="isChangeOpen = true"
      />

      <ParkAnalyticsSection
        :analytics="parkStore.analytics"
        :daily="parkStore.dailyAnalytics"
        :drivers="parkStore.drivers"
        :loading="parkStore.isLoading"
      />

      <ParkInviteSection
        :invite="parkStore.invite"
        :is-mutating="parkStore.isMutating"
        :is-peeking="isPeeking"
        @create="parkStore.createInvite()"
        @rotate="rotateInvite()"
      />

      <ParkDriversSection
        :drivers="parkStore.drivers"
        :is-mutating="parkStore.isMutating"
        :is-peeking="isPeeking"
        @remove="parkStore.removeDriver($event)"
      />
    </div>
  </WebPageShell>
</template>
