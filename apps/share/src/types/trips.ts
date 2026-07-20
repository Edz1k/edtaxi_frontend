export type TripStatus = 'cancelled' | 'completed' | 'driver_arriving' | 'driver_assigned' | 'in_progress' | 'searching'
// Полный набор категорий бэка. comfort_plus/business_plus (Хантакси) и moped
// добавились в п.30, а share про них так и не узнал — поездка в такой категории
// роняла страницу на TARIFF_META[...].label.
export type VehicleCategory = 'business' | 'business_plus' | 'comfort' | 'comfort_plus' | 'economy' | 'minivan' | 'moped' | 'moto'

// Публичный срез данных о водителе для share-страницы: без телефона и
// прочих контактов (ссылка доступна любому, у кого она есть).
export interface ShareTripDriverVehicle {
  category?: string
  color: string
  make: string
  model: string
  plate_number: string
}

export interface ShareTripDriverLocation {
  // Сколько секунд назад записана позиция (нет — возраст неизвестен,
  // например фолбэк из Postgres без таймстампа).
  age_sec?: number
  eta_sec?: number
  // Курс машины в градусах (0 = север). 0 также значит «нет данных» —
  // тогда фронт доворачивает машинку по направлению движения.
  heading?: number
  lat: number
  lng: number
}

export interface ShareTripDriver {
  avatar_url?: null | string
  // Последняя известная позиция машины + грубый ETA (только пока поездка активна).
  location?: null | ShareTripDriverLocation
  name?: string
  rating: number
  total_trips: number
  vehicle?: ShareTripDriverVehicle
}

export interface Trip {
  arrived_at?: null | string
  cancelled_at?: null | string
  cancelled_by?: null | string
  category: VehicleCategory
  completed_at?: null | string
  created_at?: string
  distance_km: number
  driver?: null | ShareTripDriver
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
