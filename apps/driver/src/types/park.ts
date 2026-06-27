import type { DriverProfile } from '~/types/driver'

export interface TaxiPark {
  bin: null | string
  commission_rate: number
  created_at: string
  description: null | string
  id: string
  is_active: boolean
  is_verified: boolean
  name: string
  owner_id: string
  phone: null | string
  status: ParkStatus
}

export type ParkStatus = 'approved' | 'pending' | 'rejected'

export interface TaxiParkRegisterPayload {
  bin?: string
  commission_rate?: number
  description?: string
  name: string
  phone?: string
}

export interface TaxiParkUpdatePayload {
  bin?: string
  commission_rate?: number
  description?: string
  name?: string
  phone?: string
}

export interface ParkInvite {
  expires_at: string
  id?: string
  token: string
  used_by?: null | string
}

export interface ParkInvitesResponse {
  invites: ParkInvite[]
}

export interface ParkDriversResponse {
  drivers: Pick<DriverProfile, 'id' | 'is_online' | 'rating' | 'total_trips' | 'user_id'>[]
}

export interface ParkAnalytics {
  driver_count: number
  total_revenue: number
  trip_count: number
}

export interface DriverAcceptInvitePayload {
  token: string
}
