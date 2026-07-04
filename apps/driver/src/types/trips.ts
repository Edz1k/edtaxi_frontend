export type TripStatus = 'cancelled' | 'completed' | 'driver_arriving' | 'driver_assigned' | 'in_progress' | 'searching'
export const TERMINAL_TRIP_STATUSES = ['cancelled', 'completed'] as const
export type VehicleCategory = 'business' | 'comfort' | 'economy' | 'minivan'

export interface Trip {
  cancelled_at?: null | string
  cancelled_by?: null | string
  // category — тариф поездки; до принятия водителем это заглушка,
  // пассажир мог заказать сразу несколько тарифов (categories).
  category: VehicleCategory
  categories?: VehicleCategory[]
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

export interface ActiveTripResponse {
  trip: null | Trip
}
