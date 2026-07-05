<script setup lang="ts">
import type { AdminAssignableRole, AdminCityStat, AdminUser, AdminUserRole } from '~/types/admin'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { getAdminCities, getAdminCityStats } from '~/api/admin'
import AppSelectDropdown from '~/components/app/AppSelectDropdown.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useListFilter } from '~/composables/useListFilter'
import { useAdminStore } from '~/stores/admin'
import { useAuthStore } from '~/stores/auth'

const admin = useAdminStore()
const auth = useAuthStore()
const { value: role, model: roleFilter } = useListFilter<AdminUserRole>()
const { value: city, model: cityFilter } = useListFilter<string>()

// Города для фильтра — справочник с бэка (оффлайн-список крупных городов КЗ).
const cityOptions = ref<Array<{ label: string, value: string }>>([{ label: 'Все города', value: '' }])
// Сводка «сколько людей в каком городе» — для быстрой статистики.
const cityStats = ref<AdminCityStat[]>([])

const isSuperAdmin = computed(() => auth.roles.includes('superadmin'))

const LIMIT = 20
const offset = ref(0)
const hasMore = computed(() => offset.value + LIMIT < admin.usersTotal)

const searchInput = ref('')
const search = refDebounced(searchInput, 350)

const roles: Array<{ label: string, value: AdminUserRole | '' }> = [
  { label: 'Все', value: '' },
  { label: 'Суперадмины', value: 'superadmin' },
  { label: 'Админы', value: 'admin' },
  { label: 'Поддержка', value: 'tech_support' },
  { label: 'Парки', value: 'park' },
  { label: 'Пассажиры', value: 'passenger' },
  { label: 'Водители', value: 'driver' },
]

const assignableRoles = computed<Array<{ label: string, value: AdminAssignableRole }>>(() => {
  if (isSuperAdmin.value) {
    return [
      { label: 'Админ', value: 'admin' },
      { label: 'Пассажир', value: 'passenger' },
      { label: 'Водитель', value: 'driver' },
      { label: 'Владелец парка', value: 'park' },
      { label: 'Техподдержка', value: 'tech_support' },
    ]
  }
  return [
    { label: 'Пассажир', value: 'passenger' },
    { label: 'Водитель', value: 'driver' },
  ]
})

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({
  title: 'Пользователи | Админка',
})

onMounted(() => {
  load()
  getAdminCities()
    .then((response) => {
      cityOptions.value = [
        { label: 'Все города', value: '' },
        ...response.cities.map(name => ({ label: name, value: name })),
      ]
    })
    .catch(() => {})
  getAdminCityStats()
    .then(response => cityStats.value = response.stats)
    .catch(() => {})
})

watch([role, city, search], () => {
  offset.value = 0
  load()
})

function load() {
  admin.loadUsers({ role: role.value || undefined, city: city.value || undefined, search: search.value || undefined, limit: LIMIT, offset: offset.value }).catch(() => {})
}

async function loadMore() {
  const nextOffset = offset.value + LIMIT
  const response = await admin.loadUsers({ role: role.value || undefined, city: city.value || undefined, search: search.value || undefined, limit: LIMIT, offset: nextOffset }).catch(() => null)
  if (response) {
    offset.value = nextOffset
  }
}

function displayName(user: { first_name: null | string, last_name: null | string, telegram_username: null | string }) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  return fullName || user.telegram_username || 'Без имени'
}

function userRoles(user: AdminUser): AdminUserRole[] {
  if (user.roles?.length)
    return user.roles
  return user.role ? [user.role] : []
}

// Кабинет пользователя: водителя открываем как /drivers/:id, остальных как
// /passengers/:id (страница пассажира работает для любого пользователя).
function profileLink(user: AdminUser) {
  return userRoles(user).includes('driver') ? `/drivers/${user.id}` : `/passengers/${user.id}`
}

function roleLabel(role: AdminUserRole) {
  return roles.find(item => item.value === role)?.label ?? role
}

function canGrantRole(user: AdminUser, role: AdminAssignableRole) {
  return !userRoles(user).includes(role)
}

function canRevokeRole(user: AdminUser, role: AdminAssignableRole) {
  const roles = userRoles(user)
  return roles.includes(role) && roles.length > 1
}

function toggleRole(user: AdminUser, role: AdminAssignableRole) {
  if (canGrantRole(user, role))
    return admin.grantUserRole(user, role)
  if (canRevokeRole(user, role))
    return admin.revokeUserRole(user, role)
}

// --- Блокировка с «наказанием»: срок + причина ---

const blockTarget = ref<AdminUser | null>(null)
const blockHours = ref(5)
const blockReason = ref('')

const BLOCK_DURATIONS = [
  { label: '1 час', value: 1 },
  { label: '5 часов', value: 5 },
  { label: '24 часа', value: 24 },
  { label: '3 суток', value: 72 },
  { label: 'Навсегда', value: 0 },
]

function openBlockDialog(user: AdminUser) {
  blockTarget.value = user
  blockHours.value = 5
  blockReason.value = ''
}

async function confirmBlock() {
  const user = blockTarget.value
  if (!user)
    return
  await admin.setUserBlocked(user, true, blockHours.value, blockReason.value.trim())
  blockTarget.value = null
}

function blockedLabel(user: AdminUser) {
  if (!user.is_blocked)
    return 'Активен'
  if (user.blocked_until)
    return `Блок до ${new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(user.blocked_until))}`
  return 'Блок'
}
</script>

<template>
  <WebPageShell
    back-label="Админка"
    back-to="/admin"
    description="Назначайте базовые роли через меню. Таксопарки и техподдержка подключаются через отдельные процессы."
    title="Пользователи"
  >
    <template #actions>
      <AppSelectDropdown v-model="cityFilter" label="Город" :options="cityOptions" />
      <AppSelectDropdown v-model="roleFilter" label="Фильтр ролей" :options="roles" />
    </template>

    <!-- Статистика по городам -->
    <div v-if="cityStats.length" class="mt-5 flex flex-wrap gap-2">
      <button
        v-for="stat in cityStats"
        :key="stat.city"
        class="border rounded-2xl px-3 py-2 text-left transition"
        :class="city === stat.city ? 'border-cyan-300/40 bg-cyan-300/12' : 'border-white/10 bg-white/6 hover:bg-white/10'"
        type="button"
        @click="cityFilter = city === stat.city ? '' : stat.city"
      >
        <p class="text-sm text-white font-950">
          {{ stat.city }} · {{ stat.total }}
        </p>
        <p class="mt-0.5 text-[11px] text-white/45 font-800">
          Водители {{ stat.drivers }} · Пассажиры {{ stat.passengers }}
        </p>
      </button>
    </div>

    <div class="relative mt-5">
      <span class="i-mdi-magnify absolute left-3.5 top-1/2 text-5 text-white/40 -translate-y-1/2" />
      <input
        v-model="searchInput"
        aria-label="Поиск по имени или номеру"
        class="h-11 w-full border border-white/10 rounded-2xl bg-white/8 pl-11 pr-4 text-sm text-white outline-none transition focus:border-cyan-400/50"
        placeholder="Поиск по имени или номеру телефона"
        type="search"
      >
    </div>

    <div class="mt-3 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
      <div class="grid-cols-[minmax(180px,1fr)_minmax(260px,1.25fr)_100px_130px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
        <span>Пользователь</span>
        <span>Роли</span>
        <span>Статус</span>
        <span class="text-right">Действие</span>
      </div>

      <div v-if="admin.isLoadingUsers && !admin.users.length" class="px-4 py-6 text-sm text-white/50">
        Загружаем пользователей...
      </div>

      <div v-else-if="!admin.users.length" class="px-4 py-6 text-sm text-white/50">
        {{ search ? 'Ничего не найдено.' : 'Пользователей нет.' }}
      </div>

      <div
        v-for="user in admin.users"
        v-else
        :key="user.id"
        class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_minmax(260px,1.25fr)_100px_130px] md:items-center last:border-b-0"
      >
        <div class="min-w-0">
          <RouterLink
            :to="profileLink(user)"
            class="flex items-center gap-1 truncate text-sm text-cyan-200 font-900 hover:underline"
          >
            {{ displayName(user) }}
            <span class="i-mdi-open-in-new shrink-0 text-3.5 text-cyan-300/70" />
          </RouterLink>
          <p class="mt-0.5 truncate text-xs text-white/42">
            {{ user.phone }}<span v-if="user.city"> · {{ user.city }}</span>
          </p>
        </div>

        <div class="min-w-0">
          <div class="mb-2 flex flex-wrap gap-1.5">
            <span
              v-for="item in userRoles(user)"
              :key="item"
              class="border border-cyan-200/16 rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] text-cyan-100 font-900"
            >
              {{ roleLabel(item) }}
            </span>
          </div>

          <DropdownMenuRoot>
            <DropdownMenuTrigger
              :disabled="admin.isMutating"
              class="h-10 inline-flex items-center gap-2 border border-white/10 rounded-2xl bg-white/7 px-3 text-sm text-white/78 font-900 outline-none transition data-[state=open]:bg-white/12 hover:bg-white/12 disabled:opacity-50"
            >
              Управлять ролями
              <span class="i-mdi-chevron-down text-5 text-cyan-200" />
            </DropdownMenuTrigger>

            <DropdownMenuPortal>
              <DropdownMenuContent
                align="start"
                class="z-60 min-w-64 border border-white/12 rounded-2xl bg-#071a38/96 p-1.5 text-white shadow-2xl shadow-black/35 outline-none backdrop-blur-xl"
                :side-offset="8"
              >
                <DropdownMenuLabel class="px-3 py-2 text-xs text-white/45 font-900 uppercase">
                  Назначить роли
                </DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  v-for="item in assignableRoles"
                  :key="item.value"
                  :disabled="admin.isMutating || (!canGrantRole(user, item.value) && !canRevokeRole(user, item.value))"
                  :model-value="userRoles(user).includes(item.value)"
                  class="data-disabled:pointer-events-none data-highlighted:bg-white/10 data-highlighted:text-white data-disabled:opacity-45 relative flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/78 font-800 outline-none transition"
                  @update:model-value="toggleRole(user, item.value)"
                >
                  <span class="h-5 w-5 flex shrink-0 items-center justify-center border border-white/14 rounded-md bg-white/6">
                    <DropdownMenuItemIndicator>
                      <span class="i-mdi-check text-cyan-200" />
                    </DropdownMenuItemIndicator>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block">{{ item.label }}</span>
                    <span v-if="item.value === 'admin'" class="mt-0.5 block text-[11px] text-white/40">
                      Только суперадмин
                    </span>
                  </span>
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator class="my-1 h-px bg-white/10" />
                <DropdownMenuLabel class="px-3 py-2 text-[11px] text-white/38 leading-4">
                  Последнюю роль пользователя снять нельзя.
                </DropdownMenuLabel>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </div>

        <span
          class="w-fit rounded-full px-3 py-1.5 text-xs font-900 md:w-auto md:rounded-none md:px-0 md:py-0 md:text-sm"
          :class="user.is_blocked ? 'bg-red-500/12 text-red-300 md:bg-transparent' : 'bg-emerald-500/12 text-emerald-300 md:bg-transparent'"
          :title="user.blocked_reason || undefined"
        >
          {{ blockedLabel(user) }}
        </span>

        <button
          :disabled="admin.isMutating"
          class="h-10 rounded-xl text-sm font-900 transition active:scale-[0.98] disabled:opacity-60"
          :class="user.is_blocked ? 'bg-emerald-500/12 text-emerald-300' : 'bg-red-500/12 text-red-300'"
          type="button"
          @click="user.is_blocked ? admin.setUserBlocked(user, false) : openBlockDialog(user)"
        >
          {{ user.is_blocked ? 'Разблок' : 'Блок' }}
        </button>
      </div>
    </div>

    <!-- Диалог блокировки: срок («наказание») + причина -->
    <div
      v-if="blockTarget"
      class="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      @click.self="blockTarget = null"
    >
      <div class="max-w-md w-full border border-white/12 rounded-3xl bg-#071a38/96 p-5 text-white shadow-2xl shadow-black/40">
        <h3 class="text-lg font-950">
          Заблокировать {{ displayName(blockTarget) }}
        </h3>
        <p class="mt-1 text-sm text-white/50">
          {{ blockTarget.phone }}
        </p>

        <p class="mt-4 text-xs text-white/45 font-900 uppercase">
          Срок блокировки
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="duration in BLOCK_DURATIONS"
            :key="duration.value"
            class="h-9 rounded-xl px-3 text-sm font-900 transition active:scale-[0.97]"
            :class="blockHours === duration.value ? 'bg-cyan-400 text-#06142f' : 'bg-white/8 text-white/70 hover:bg-white/12'"
            type="button"
            @click="blockHours = duration.value"
          >
            {{ duration.label }}
          </button>
        </div>

        <p class="mt-4 text-xs text-white/45 font-900 uppercase">
          Причина
        </p>
        <textarea
          v-model="blockReason"
          class="mt-2 h-24 w-full resize-none border border-white/10 rounded-2xl bg-white/6 p-3 text-sm outline-none transition focus:border-cyan-300/50"
          maxlength="500"
          placeholder="Например: грубость с пассажиром, отмены заказов..."
        />

        <div class="mt-4 flex gap-2">
          <button
            class="h-11 flex-1 rounded-2xl bg-white/8 text-sm font-900 transition active:scale-[0.98]"
            type="button"
            @click="blockTarget = null"
          >
            Отмена
          </button>
          <button
            :disabled="admin.isMutating || !blockReason.trim()"
            class="h-11 flex-1 rounded-2xl bg-red-500/80 text-sm text-white font-900 transition active:scale-[0.98] disabled:opacity-50"
            type="button"
            @click="confirmBlock"
          >
            {{ admin.isMutating ? 'Блокируем...' : 'Заблокировать' }}
          </button>
        </div>
      </div>
    </div>

    <div class="mt-3 flex items-center justify-between">
      <p class="text-xs text-white/40">
        Показано {{ admin.users.length }} из {{ admin.usersTotal }}
      </p>
      <button
        v-if="hasMore"
        :disabled="admin.isLoadingUsers"
        class="h-9 border border-white/12 rounded-xl bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-50"
        type="button"
        @click="loadMore"
      >
        {{ admin.isLoadingUsers ? 'Загружаем...' : 'Загрузить ещё' }}
      </button>
    </div>
  </WebPageShell>
</template>
