export type TripStatus = 'cancelled' | 'completed' | 'driver_arriving' | 'driver_assigned' | 'in_progress' | 'searching'
export type VehicleCategory = 'business' | 'comfort' | 'economy' | 'minivan'

// TripDriverVehicle/TripDriver — данные назначенного водителя, которые бэкенд
// подмешивает в детализацию поездки (админка) — см. admin.go tripDetailMap.
export interface TripDriverVehicle {
  category: VehicleCategory
  color: string
  make: string
  model: string
  plate_number: string
}

export interface TripDriver {
  avatar_url?: null | string
  name?: string
  phone?: string
  rating: number
  total_trips: number
  // user_id — для ссылки в кабинет водителя (/drivers/:id); driver_id самой
  // поездки — это drivers.id, другой ключ, им кабинет не откроется.
  user_id?: string
  vehicle?: TripDriverVehicle
}

export interface Trip {
  cancelled_at?: null | string
  cancelled_by?: null | string
  category: VehicleCategory
  completed_at?: null | string
  created_at?: string
  distance_km: number
  driver?: null | TripDriver
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
  // passenger_name/phone — подтягиваются бэкендом только в детализации поездки
  // для админки (не в списке).
  passenger_name?: string
  passenger_phone?: string
  payment_method?: null | string
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  started_at?: null | string
  status: TripStatus
  surge_multiplier: number
}
