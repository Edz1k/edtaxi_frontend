export type TripStatus = 'cancelled' | 'completed' | 'driver_arriving' | 'driver_assigned' | 'in_progress' | 'searching'
export type VehicleCategory = 'business' | 'comfort' | 'economy' | 'minivan' | 'moto'

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
