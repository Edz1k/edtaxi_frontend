import type { AuthRole } from '~/types/auth'
import type { Trip, TripStatus } from '~/types/trips'

export type AdminUserRole = AuthRole
export type AdminAssignableRole = Exclude<AuthRole, 'superadmin'>

export interface AdminTechSupportNumber {
  added_by: null | string
  created_at: string
  name?: null | string
  phone: string
}

// Счётчик обращений для страницы техподдержки: решено / всего.
export interface AdminSupportStats {
  open: number
  resolved: number
  total: number
}

export interface AdminUser {
  avatar_url: null | string
  // До какого момента действует блокировка (null = бессрочная) и её причина.
  blocked_reason?: null | string
  blocked_until?: null | string
  // Город (определяется по координатам пользователя).
  city?: null | string
  created_at: string
  first_name: null | string
  id: string
  is_active: boolean
  is_blocked: boolean
  last_name: null | string
  phone: string
  role?: AdminUserRole
  roles: AdminUserRole[]
  telegram_username: null | string
  updated_at?: string
}

export interface AdminListUsersParams {
  city?: string
  limit?: number
  offset?: number
  role?: AdminUserRole | ''
  // search — поиск по имени/фамилии/телефону/telegram-юзернейму (регистронезависимо).
  search?: string
}

// Сводка по городу: всего пользователей и сколько из них водителей/пассажиров.
export interface AdminCityStat {
  city: string
  drivers: number
  passengers: number
  total: number
}

export interface AdminListUsersResponse {
  limit: number
  offset: number
  total: number
  users: AdminUser[]
}

export interface AdminBlockUserPayload {
  blocked: boolean
  // hours > 0 — временная блокировка («наказание» на N часов), 0/не задано — бессрочная.
  hours?: number
  reason?: string
}

export interface AdminBlockUserResponse {
  is_blocked: boolean
  message: string
}

export interface AdminUpdateUserRolesPayload {
  role: AdminAssignableRole
}

export interface AdminUpdateUserRolesResponse {
  id: string
  roles: AdminUserRole[]
}

export interface AdminListTripsParams {
  // city — фильтр по городу подачи (ближайший к точке pickup, справочник /admin/cities).
  city?: string
  limit?: number
  offset?: number
  // search — поиск по пассажиру/водителю (имя, телефон) и адресам маршрута.
  search?: string
  status?: TripStatus | ''
}

export interface AdminListTripsResponse {
  limit: number
  offset: number
  total: number
  trips: Trip[]
}

export interface CreateParkOwnerPayload {
  phone: string
  name?: string
}

export interface CreateParkOwnerResponse {
  id: string
  phone: string
  roles: AdminUserRole[]
  first_name: null | string
  last_name: null | string
  created_at: string
}

export interface AdminListTechSupportNumbersResponse {
  numbers: AdminTechSupportNumber[]
}

export interface PlatformSettingsLimitRange {
  min: number
  max: number
}

// Настройки платформы: комиссия (0 = акция «без комиссии») и коэффициент цены.
// limits — допустимые диапазоны, бэкенд отдаёт их вместе со значениями.
export interface PlatformSettings {
  platform_commission_rate: number
  price_coefficient: number
  max_park_commission_rate: number
  limits: {
    platform_commission_rate: PlatformSettingsLimitRange
    price_coefficient: PlatformSettingsLimitRange
  }
  updated_at: string
}

export interface PlatformSettingsUpdatePayload {
  platform_commission_rate?: number
  price_coefficient?: number
}

export interface AdminTechSupportNumberPayload {
  phone: string
  name?: string
}

export type TariffCategory = 'business' | 'comfort' | 'economy' | 'minivan' | 'moto'

// Тариф платформы (park_id IS NULL) — базовые параметры расчёта цены плюс
// surge_max, потолок коэффициента спроса для категории.
// name — произвольное название тарифа; пустая строка = стандартное название категории.
export interface Tariff {
  id: string
  category: TariffCategory
  name: string
  base_fare: number
  per_km: number
  per_min: number
  min_fare: number
  surge_max: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TariffPayload {
  category?: TariffCategory
  name?: string
  base_fare: number
  per_km: number
  per_min: number
  min_fare: number
  surge_max: number
  is_active?: boolean
}

export interface AdminListTariffsResponse {
  tariffs: Tariff[]
}

// Текущий срез спроса на категорию — те же счётчики и коэффициент, что
// использует живой расчёт цены поездки, но платформенные (без гео-радиуса).
export interface CategoryDemand {
  category: TariffCategory
  active_searching: number
  available_drivers: number
  ratio: number
  coefficient: number
  surge_max: number
}

// Средний коэффициент спроса категории для часа суток за последние ~30 дней истории.
export interface DemandForecastPoint {
  category: TariffCategory
  hour: number
  avg_coefficient: number
  samples: number
}

export interface DemandOverview {
  current: CategoryDemand[]
  forecast: DemandForecastPoint[]
}
