import type { AuthRole } from '~/types/auth'
import type { Trip, TripStatus } from '~/types/trips'

export type AdminUserRole = AuthRole
export type AdminAssignableRole = Exclude<AuthRole, 'park' | 'superadmin' | 'tech_support'>

export interface AdminTechSupportNumber {
  added_by: null | string
  created_at: string
  phone: string
}

export interface AdminUser {
  avatar_url: null | string
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
  limit?: number
  offset?: number
  role?: AdminUserRole | ''
}

export interface AdminListUsersResponse {
  limit: number
  offset: number
  total: number
  users: AdminUser[]
}

export interface AdminBlockUserPayload {
  blocked: boolean
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
  limit?: number
  offset?: number
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

export interface AdminTechSupportNumberPayload {
  phone: string
}
