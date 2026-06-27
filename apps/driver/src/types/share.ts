import type { Trip } from '~/types/trips'

export interface TripShareResponse {
  expires_at: string
  share_token: string
}

export interface PublicTripShareResponse {
  expires_at: string
  trip: Trip
  view_count: number
}
