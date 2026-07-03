<script setup lang="ts">
import type { ParkStatus, TaxiPark } from '~/types/park'
import AppSelectDropdown from '~/components/app/AppSelectDropdown.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useListFilter } from '~/composables/useListFilter'
import { useAdminStore } from '~/stores/admin'
import { useAuthStore } from '~/stores/auth'
import { formatDate } from '~/utils/format'

const admin = useAdminStore()
const auth = useAuthStore()
// Просмотр кабинета чужого парка (?park_id=) поддерживает только бэкенд для
// RoleSuperAdmin — обычным admin ссылка ничего не даст, поэтому не показываем.
const canPeekParks = computed(() => auth.hasRole('superadmin'))
const { value: statusFilter, model: statusModel } = useListFilter<ParkStatus | ''>('pending')

const rejectingPark = ref<TaxiPark | null>(null)
const rejectReason = ref('')

const statusOptions: Array<{ label: string, value: ParkStatus | '' }> = [
  { label: 'Все', value: '' },
  { label: 'Ожидают', value: 'pending' },
  { label: 'Одобренные', value: 'approved' },
  { label: 'Отклонённые', value: 'rejected' },
]

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({
  title: 'Таксопарки | Админка',
})

onMounted(() => {
  loadParks()
})

watch(statusFilter, () => loadParks())

function loadParks() {
  admin.loadParks({ status: statusFilter.value || undefined }).catch(() => {})
}

function openRejectModal(park: TaxiPark) {
  rejectingPark.value = park
  rejectReason.value = ''
}

function closeRejectModal() {
  rejectingPark.value = null
  rejectReason.value = ''
}

async function confirmReject() {
  if (!rejectingPark.value)
    return
  await admin.rejectPark(rejectingPark.value, rejectReason.value).catch(() => {})
  closeRejectModal()
}

function parkStatusClass(park: TaxiPark) {
  if (park.status === 'approved' || park.is_verified)
    return 'bg-emerald-500/12 text-emerald-300 md:bg-transparent'
  if (park.status === 'rejected')
    return 'bg-red-500/12 text-red-300 md:bg-transparent'
  return 'bg-amber-500/12 text-amber-300 md:bg-transparent'
}

function parkStatusLabel(park: TaxiPark) {
  if (park.status === 'approved' || park.is_verified)
    return 'Проверен'
  if (park.status === 'rejected')
    return 'Отклонён'
  return 'Ожидает'
}
</script>

<template>
  <WebPageShell
    back-label="Админка"
    back-to="/admin"
    description="Здесь менеджеры видят созданные таксопарки, подтверждают готовые карточки и отклоняют лишние заявки."
    title="Таксопарки"
  >
    <template #actions>
      <AppSelectDropdown v-model="statusModel" label="Статус" :options="statusOptions" />
      <button
        :disabled="admin.isLoadingParks"
        class="h-11 inline-flex items-center gap-2 border border-white/12 rounded-full bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-60"
        type="button"
        @click="loadParks()"
      >
        <span class="i-mdi-refresh text-5 text-cyan-200" :class="{ 'animate-spin': admin.isLoadingParks }" />
        {{ admin.isLoadingParks ? 'Обновляем...' : 'Обновить' }}
      </button>
    </template>

    <!-- Rejection modal -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
        <div
          v-if="rejectingPark"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          @click.self="rejectingPark = null"
        >
          <form
            class="max-w-lg w-full border border-white/10 rounded-3xl bg-#071a38 p-6 shadow-2xl"
            @submit.prevent="confirmReject()"
          >
            <h2 class="text-xl font-950">
              Отклонить таксопарк
            </h2>
            <p class="mt-1 text-sm text-white/55">
              {{ rejectingPark.name }}
            </p>

            <label class="grid mt-5 gap-1.5">
              <span class="text-xs text-white/42 font-900 uppercase">Причина отклонения</span>
              <textarea
                v-model="rejectReason"
                class="w-full border border-white/10 rounded-xl bg-white/8 px-4 py-3 text-sm outline-none focus:border-red-300/40"
                maxlength="500"
                placeholder="Укажите причину для владельца парка..."
                rows="3"
              />
            </label>

            <div class="mt-5 flex gap-3">
              <button
                :disabled="admin.isMutating"
                class="h-11 flex-1 rounded-2xl bg-red-500 text-sm text-white font-900 transition hover:bg-red-400 disabled:opacity-60"
                type="submit"
              >
                {{ admin.isMutating ? 'Отклоняем...' : 'Отклонить' }}
              </button>
              <button
                class="h-11 border border-white/12 rounded-2xl bg-white/8 px-5 text-sm font-900 transition hover:bg-white/12"
                type="button"
                @click="closeRejectModal()"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>

    <div class="mt-5 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
      <div class="grid-cols-[minmax(180px,1fr)_130px_130px_130px_220px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
        <span>Парк</span>
        <span>БИН</span>
        <span>Статус</span>
        <span>Создан</span>
        <span class="text-right">Действие</span>
      </div>

      <div v-if="admin.isLoadingParks" class="px-4 py-6 text-sm text-white/50">
        Загружаем таксопарки...
      </div>

      <div v-else-if="!admin.parks.length" class="px-4 py-6 text-sm text-white/50">
        Таксопарков нет.
      </div>

      <div
        v-for="park in admin.parks"
        v-else
        :key="park.id"
        class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_130px_130px_130px_220px] md:items-center last:border-b-0"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-900">
            {{ park.name }}
          </p>
          <p class="mt-0.5 truncate text-xs text-white/42">
            {{ park.phone || park.owner_id }}
          </p>
          <p v-if="park.status === 'rejected' && park.rejection_reason" class="mt-0.5 truncate text-xs text-red-300/80 font-700">
            {{ park.rejection_reason }}
          </p>
        </div>

        <span class="truncate text-sm text-white/62 font-800">{{ park.bin || '—' }}</span>

        <span
          class="w-fit rounded-full px-3 py-1.5 text-xs font-900 md:w-auto md:rounded-none md:px-0 md:py-0 md:text-sm"
          :class="parkStatusClass(park)"
        >
          {{ parkStatusLabel(park) }}
        </span>

        <span class="text-sm text-white/50 font-800">{{ formatDate(park.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) }}</span>

        <div class="flex flex-wrap items-center justify-start gap-2 md:justify-end">
          <RouterLink
            v-if="canPeekParks"
            class="h-10 inline-flex items-center gap-2 border border-white/12 rounded-xl bg-white/8 px-3 text-sm font-900 transition hover:bg-white/14"
            :to="`/park?park_id=${park.id}`"
          >
            <span class="i-mdi-eye-outline text-4.5 text-cyan-200" />
            Кабинет
          </RouterLink>
          <button
            :disabled="admin.isMutating || park.status === 'approved'"
            class="h-10 rounded-xl px-4 text-sm font-900 transition active:scale-[0.98] disabled:opacity-50"
            :class="park.status === 'approved' ? 'bg-white/8 text-white/45' : 'bg-cyan-300 text-#06142f'"
            type="button"
            @click="admin.verifyPark(park)"
          >
            {{ park.status === 'approved' ? 'Одобрено' : 'Подтвердить' }}
          </button>
          <button
            v-if="park.status !== 'approved'"
            :disabled="admin.isMutating"
            class="h-10 rounded-xl bg-red-500/12 px-3 text-sm text-red-300 font-900 transition active:scale-[0.98] disabled:opacity-50"
            type="button"
            @click="openRejectModal(park)"
          >
            Отклонить
          </button>
        </div>
      </div>
    </div>
  </WebPageShell>
</template>
