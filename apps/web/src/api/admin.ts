import type {
  AdminBlockUserPayload,
  AdminBlockUserResponse,
  AdminListTechSupportNumbersResponse,
  AdminListTripsParams,
  AdminListTripsResponse,
  AdminListUsersParams,
  AdminListUsersResponse,
  AdminTechSupportNumber,
  AdminTechSupportNumberPayload,
  AdminUpdateUserRolesPayload,
  AdminUpdateUserRolesResponse,
  CreateParkOwnerPayload,
  CreateParkOwnerResponse,
} from '~/types/admin'
import type { Trip } from '~/types/trips'
import { apiRequest } from '~/api/client'

function buildListParams(params: AdminListTripsParams | AdminListUsersParams) {
  return {
    limit: params.limit,
    offset: params.offset,
    role: 'role' in params ? params.role || undefined : undefined,
    status: 'status' in params ? params.status || undefined : undefined,
  }
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
