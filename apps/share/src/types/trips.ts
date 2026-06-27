export type TripStatus = 'cancelled' | 'completed' | 'driver_arriving' | 'driver_assigned' | 'in_progress' | 'searching'
export const TERMINAL_TRIP_STATUSES = ['cancelled', 'completed'] as const
export type TripFlowState = 'driver_arriving' | 'driver_assigned' | 'finished' | 'idle' | 'in_progress' | 'route_ready' | 'searching' | 'tariffs'
export type VehicleCategory = 'business' | 'comfort' | 'economy' | 'minivan'

export interface EstimateTripPayload {
  category: VehicleCategory
  distance_km: number
  duration_min: number
}

export interface EstimateTripResponse {
  category: VehicleCategory
  distance_km: number
  duration_min: number
  estimated_fare: number
  surge_multiplier: number
}

export interface CreateTripPayload extends EstimateTripPayload {
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
}

export interface Trip {
  cancelled_at?: null | string
  cancelled_by?: null | string
  category: VehicleCategory
  completed_at?: null | string
  created_at?: string
  distance_km: number
  driver_assigned_at?: null | string
  driver_id?: null | string
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  duration_min: number
  estimated_fare: number
  final_fare?: null | number
  id: string
  passenger_id?: string
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  started_at?: null | string
  status: TripStatus
  surge_multiplier: number
}

export interface TripHistoryResponse {
  limit: number
  offset: number
  trips: Trip[]
}

export interface ActiveTripResponse {
  trip: null | Trip
}

export interface RateTripPayload {
  comment?: string
  score: number
}
