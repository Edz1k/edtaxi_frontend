export type TripStatus = 'cancelled' | 'completed' | 'driver_arriving' | 'driver_assigned' | 'in_progress' | 'searching'
export const TERMINAL_TRIP_STATUSES = ['cancelled', 'completed'] as const
export type VehicleCategory = 'business' | 'comfort' | 'economy' | 'minivan' | 'moto'

export interface Trip {
  // Момент прибытия к пассажиру — точка отсчёта бесплатного ожидания.
  arrived_at?: null | string
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
  // Надбавка за платное ожидание (в final_fare) и правила её расчёта.
  waiting_fee?: number
  waiting_free_minutes?: number
  waiting_per_minute_fee?: number
}

export interface ActiveTripResponse {
  trip: null | Trip
}
