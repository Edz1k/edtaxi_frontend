import type {
  AdminBlockUserPayload,
  AdminBlockUserResponse,
  AdminCityStat,
  AdminListTariffsResponse,
  AdminListTechSupportNumbersResponse,
  AdminListTripsParams,
  AdminListTripsResponse,
  AdminListUsersParams,
  AdminListUsersResponse,
  AdminOverview,
  AdminSupportStats,
  AdminTechSupportNumber,
  AdminTechSupportNumberPayload,
  AdminUpdateUserRolesPayload,
  AdminUpdateUserRolesResponse,
  CreateParkOwnerPayload,
  CreateParkOwnerResponse,
  DemandOverview,
  PlatformSettings,
  PlatformSettingsUpdatePayload,
  Tariff,
  TariffPayload,
} from '~/types/admin'
import type { AdminListPayoutsParams, PayoutsResponse } from '~/types/payout'
import type { AdminSupportRoomsParams, SupportListRoomsResponse } from '~/types/support'
import type { Trip } from '~/types/trips'
import { apiRequest } from '~/api/client'

// У роли tech_support нет доступа к /admin/*, статистика для неё живёт на
// отдельном эндпоинте с тем же форматом ответа.
export type SupportStatsScope = 'admin' | 'tech_support'

const SUPPORT_STATS_ENDPOINTS: Record<SupportStatsScope, string> = {
  admin: '/admin/support/stats',
  tech_support: '/tech-support/chats/stats',
}

function buildListParams(params: AdminListTripsParams | AdminListUsersParams) {
  return {
    limit: params.limit,
    offset: params.offset,
    role: 'role' in params ? params.role || undefined : undefined,
    city: 'city' in params ? params.city || undefined : undefined,
    status: 'status' in params ? params.status || undefined : undefined,
    search: 'search' in params ? params.search || undefined : undefined,
  }
}

// Справочник городов (оффлайн-список крупных городов Казахстана на бэке).
export function getAdminCities() {
  return apiRequest<{ cities: string[] }>('/admin/cities')
}

export function getAdminCityStats() {
  return apiRequest<{ stats: AdminCityStat[] }>('/admin/users/city-stats')
}

export function listAdminUsers(params: AdminListUsersParams = {}) {
  return apiRequest<AdminListUsersResponse>('/admin/users', {
    params: buildListParams(params),
  })
}

export function blockAdminUser(id: string, payload: AdminBlockUserPayload) {
  return apiRequest<AdminBlockUserResponse>(`/admin/users/${id}/block`, {
    method: 'PUT',
    body: payload,
  })
}

export function addAdminUserRole(id: string, payload: AdminUpdateUserRolesPayload) {
  return apiRequest<AdminUpdateUserRolesResponse>(`/admin/users/${id}/roles`, {
    method: 'POST',
    body: payload,
  })
}

export function removeAdminUserRole(id: string, role: AdminUpdateUserRolesPayload['role']) {
  return apiRequest<AdminUpdateUserRolesResponse>(`/admin/users/${id}/roles/${role}`, {
    method: 'DELETE',
  })
}

export function listAdminTrips(params: AdminListTripsParams = {}) {
  return apiRequest<AdminListTripsResponse>('/admin/trips', {
    params: buildListParams(params),
  })
}

export function getAdminTrip(id: string) {
  return apiRequest<Trip>(`/admin/trips/${id}`)
}

export function createParkOwner(payload: CreateParkOwnerPayload) {
  return apiRequest<CreateParkOwnerResponse>('/admin/park-owners', {
    method: 'POST',
    body: payload,
  })
}

export function listTechSupportNumbers() {
  return apiRequest<AdminListTechSupportNumbersResponse>('/admin/tech-support-numbers')
}

export function getSupportStats(scope: SupportStatsScope = 'admin') {
  return apiRequest<AdminSupportStats>(SUPPORT_STATS_ENDPOINTS[scope])
}

export function listAdminSupportRooms(params: AdminSupportRoomsParams = {}) {
  return apiRequest<SupportListRoomsResponse>('/admin/support/rooms', {
    params: {
      limit: params.limit,
      offset: params.offset,
      status: params.status || undefined,
      participant_type: params.participant_type || undefined,
    },
  })
}

// Назначает агентом обращения текущего пользователя (бэкенд не принимает тело).
export function assignAdminSupportRoom(id: string) {
  return apiRequest<{ message: string }>(`/admin/support/rooms/${id}/assign`, {
    method: 'POST',
  })
}

export function closeAdminSupportRoom(id: string) {
  return apiRequest<{ message: string }>(`/admin/support/rooms/${id}/close`, {
    method: 'POST',
  })
}

export function getPlatformSettings() {
  return apiRequest<PlatformSettings>('/admin/settings')
}

export function updatePlatformSettings(payload: PlatformSettingsUpdatePayload) {
  return apiRequest<PlatformSettings>('/admin/settings', {
    method: 'PUT',
    body: payload,
  })
}

export function listAdminPayouts(params: AdminListPayoutsParams = {}) {
  return apiRequest<PayoutsResponse>('/admin/payouts', {
    params: {
      status: params.status || undefined,
      limit: params.limit,
      offset: params.offset,
    },
  })
}

export function markAdminPayoutPaid(id: string) {
  return apiRequest<{ message: string }>(`/admin/payouts/${id}/paid`, {
    method: 'POST',
  })
}

export function rejectAdminPayout(id: string, reason = '') {
  return apiRequest<{ message: string }>(`/admin/payouts/${id}/reject`, {
    method: 'POST',
    body: { reason },
  })
}

export function getDemandOverview() {
  return apiRequest<DemandOverview>('/admin/demand')
}

// Обзорный дашборд: тоталы платформы + серии по дням (30) и месяцам (12).
export function getAdminOverview() {
  return apiRequest<AdminOverview>('/admin/overview')
}

export function listAdminTariffs() {
  return apiRequest<AdminListTariffsResponse>('/admin/tariffs')
}

export function createAdminTariff(payload: TariffPayload) {
  return apiRequest<Tariff>('/admin/tariffs', {
    method: 'POST',
    body: payload,
  })
}

export function updateAdminTariff(id: string, payload: TariffPayload) {
  return apiRequest<Tariff>(`/admin/tariffs/${id}`, {
    method: 'PUT',
    body: payload,
  })
}

export function addTechSupportNumber(payload: AdminTechSupportNumberPayload) {
  return apiRequest<AdminTechSupportNumber>('/admin/tech-support-numbers', {
    method: 'POST',
    body: payload,
  })
}

export function removeTechSupportNumber(payload: AdminTechSupportNumberPayload) {
  return apiRequest<{ message: string }>('/admin/tech-support-numbers', {
    method: 'DELETE',
    body: payload,
  })
}
