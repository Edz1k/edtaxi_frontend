<script setup lang="ts">
import type { AdminAssignableRole, AdminUser, AdminUserRole } from '~/types/admin'
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
import AppSelectDropdown from '~/components/app/AppSelectDropdown.vue'
import WebPageShell from '~/components/app/WebPageShell.vue'
import { useListFilter } from '~/composables/useListFilter'
import { useAdminStore } from '~/stores/admin'
import { useAuthStore } from '~/stores/auth'

const admin = useAdminStore()
const auth = useAuthStore()
const { value: role, model: roleFilter } = useListFilter<AdminUserRole>()

const isSuperAdmin = computed(() => auth.roles.includes('superadmin'))

const LIMIT = 20
const offset = ref(0)
const hasMore = computed(() => offset.value + LIMIT < admin.usersTotal)

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
})

watch(role, () => {
  offset.value = 0
  load()
})

function load() {
  admin.loadUsers({ role: role.value || undefined, limit: LIMIT, offset: offset.value }).catch(() => {})
}

async function loadMore() {
  const nextOffset = offset.value + LIMIT
  const response = await admin.loadUsers({ role: role.value || undefined, limit: LIMIT, offset: nextOffset }).catch(() => null)
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
</script>

<template>
  <WebPageShell
    back-label="Админка"
    back-to="/admin"
    description="Назначайте базовые роли через меню. Таксопарки и техподдержка подключаются через отдельные процессы."
    title="Пользователи"
  >
    <template #actions>
      <AppSelectDropdown v-model="roleFilter" label="Фильтр ролей" :options="roles" />
    </template>

    <div class="mt-5 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
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
        Пользователей нет.
      </div>

      <div
        v-for="user in admin.users"
        v-else
        :key="user.id"
        class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_minmax(260px,1.25fr)_100px_130px] md:items-center last:border-b-0"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-900">
            {{ displayName(user) }}
          </p>
          <p class="mt-0.5 truncate text-xs text-white/42">
            {{ user.phone }}
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
                  class="relative flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/78 font-800 outline-none transition data-disabled:pointer-events-none data-highlighted:bg-white/10 data-highlighted:text-white data-disabled:opacity-45"
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
        >
          {{ user.is_blocked ? 'Блок' : 'Активен' }}
        </span>

        <button
          :disabled="admin.isMutating"
          class="h-10 rounded-xl text-sm font-900 transition active:scale-[0.98] disabled:opacity-60"
          :class="user.is_blocked ? 'bg-emerald-500/12 text-emerald-300' : 'bg-red-500/12 text-red-300'"
          type="button"
          @click="admin.setUserBlocked(user, !user.is_blocked)"
        >
          {{ user.is_blocked ? 'Разблок' : 'Блок' }}
        </button>
      </div>
    </div>

    <div class="mt-3 flex items-center justify-between">
      <p class="text-xs text-white/40">
        Показано {{ admin.users.length }} из {{ admin.usersTotal }}
      </p>
      <button
        v-if="hasMore"
        :disabled="admin.isLoadingUsers"
        class="h-9 rounded-xl border border-white/12 bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12 disabled:opacity-50"
        type="button"
        @click="loadMore"
      >
        {{ admin.isLoadingUsers ? 'Загружаем...' : 'Загрузить ещё' }}
      </button>
    </div>
  </WebPageShell>
</template>
