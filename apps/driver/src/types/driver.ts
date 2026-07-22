import type { TripStop, VehicleCategory } from '~/types/trips'

export type VerificationStatus = 'approved' | 'pending' | 'rejected'
export type DriverTripStep = 'arrived' | 'in_progress' | 'to_pickup'

// Слоты фото машины для верификации. required-набор приходит с бэка,
// doc_insurance и vin — необязательные для машин; для мото страховка
// обязательна, плюс отдельный слот moto_second_helmet (второй шлем пассажира).
export type VehiclePhotoSlot
  = | 'dashboard'
    | 'doc_insurance'
    | 'doc_registration_back'
    | 'doc_registration_front'
    | 'exterior_back'
    | 'exterior_front'
    | 'exterior_left'
    | 'exterior_right'
    | 'interior_back'
    | 'interior_front'
    | 'moto_second_helmet'
    | 'trunk'
    | 'vin'

export interface VehicleSlotPhoto {
  slot: VehiclePhotoSlot
  photo_url: string
}

export interface VehiclePhotosResponse {
  photos: VehicleSlotPhoto[]
  required: VehiclePhotoSlot[]
  missing: VehiclePhotoSlot[]
  can_submit: boolean
}

export interface SubmitVehiclePhotosResponse {
  verification_status: VerificationStatus
}

// available — тарифы, доступные по одобренным машинам водителя;
// active — тарифы, по которым он сейчас принимает заказы.
export interface DriverCategoriesResponse {
  available: VehicleCategory[]
  active: VehicleCategory[]
}

// Районы приёма заказов (город определяется по текущей локации водителя;
// пустой active = весь город).
export interface DriverDistrict {
  id: string
  name: string
  // polygon — геометрия (GeoJSON) для подсветки района на карте; бэкенд отдаёт
  // упрощённый ST_AsGeoJSON, у сид-районов есть, у ручных — тоже.
  polygon?: { coordinates: number[][][][], type: 'MultiPolygon' | 'Polygon' } | null
}

export interface DriverDistrictsResponse {
  city: string
  available: DriverDistrict[]
  active: string[]
}

// Режим «Домой»: только заказы с конечной точкой в 5 км от дома, до 2
// активаций в сутки, автоснятие через 3 часа или по завершении поездки у дома.
export interface HomeModeState {
  active: boolean
  until: null | string
  lat: null | number
  lng: null | number
  address: null | string
  used_today: number
  limit: number
}

export interface DriverVehicleVerification {
  id: string
  driver_id: string
  // category — легаси-скаляр (старший из categories), оставлен для совместимости.
  category: VehicleCategory
  categories?: VehicleCategory[]
  plate_number: string
  make: string
  model: string
  year: number
  color: string
  is_active: boolean
  verification_status: VerificationStatus
  // Пер-блочные вердикты фотоконтроля: фото машины / документы + причина
  // отказа (что именно исправить).
  photos_check?: VerificationStatus
  docs_check?: VerificationStatus
  rejection_reason?: null | string
  verification_photo_url: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface DriverVerificationsResponse {
  face_verified: boolean
  // face_status: none | pending | approved | rejected — статус проверки лица
  // поддержкой. face_photo_url появляется после загрузки селфи.
  face_status: 'approved' | 'none' | 'pending' | 'rejected'
  face_photo_url: null | string
  // Пер-блочные вердикты идентификации личности + причина отказа.
  face_selfie_check?: VerificationStatus
  face_doc_check?: VerificationStatus
  face_rejection_reason?: null | string
  // Имя с удостоверения, подтверждённое поддержкой (TODO п.27): под ним водителя
  // показывают пассажирам. null/undefined — саппорт ещё не заполнял.
  verified_first_name?: null | string
  verified_last_name?: null | string
  // has_approved_vehicle — есть хотя бы одна одобренная машина. Именно так
  // бэкенд решает, пускать ли водителя на линию.
  has_approved_vehicle: boolean
  daily_check_valid: boolean
  // Момент истечения фотоконтроля (ISO). Отсчёт идёт от одобрения поддержкой,
  // а не от отправки фото. По нему приложение гасит кнопку «на линии» само, не
  // дожидаясь фонового прохода на сервере. undefined — старый бэкенд.
  daily_check_valid_until?: null | string
  // Последний дэйлик с блочными вердиктами (null, если проверок не было).
  latest_daily_check?: DailyCheck | null
  vehicles: DriverVehicleVerification[]
}

export type VerificationReminderItem = 'face' | 'vehicle'

export interface VerificationReminder {
  should_remind: boolean
  pending: VerificationReminderItem[]
  face_status: DriverVerificationsResponse['face_status']
}

// DailyCheckStatus — статусы дэйлика: к общим трём добавлен 'expired' (заявку
// не успели рассмотреть за отведённое время). Отдельный тип, а не расширение
// VerificationStatus: у лица и машин такого статуса нет, и подмешивать его в
// общий юнион означало бы ослабить проверки там.
export type DailyCheckStatus = VerificationStatus | 'expired'

export interface DailyCheck {
  id: string
  driver_id: string
  vehicle_id: string
  selfie_url: string
  vehicle_photo_url: string
  status: DailyCheckStatus
  // Пер-блочные вердикты дэйлика: селфи / фото машины.
  selfie_check?: VerificationStatus
  vehicle_check?: VerificationStatus
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

// Гео-проверка «Я на месте»/«Завершить» на сервере. Режим И радиусы приходят
// с бэкенда: калибровка после наблюдений не должна требовать релиза апы.
//   off     — не проверяет;
//   warn    — логирует дистанции, действие пропускает (кнопку НЕ блокируем);
//   enforce — блокирует (409).
export interface DriverGeoGate {
  mode: 'enforce' | 'off' | 'warn'
  arrival_radius_m: number
  completion_radius_m: number
}

export interface DriverProfile {
  id: string
  is_available: boolean
  is_online: boolean
  rating: number
  total_trips: number
  user_id: string
  // Нет у старого бэкенда — тогда гейт считается выключенным.
  geo_gate?: DriverGeoGate
}

export interface DriverStatusResponse {
  is_available: boolean
  is_online: boolean
}

export interface DriverStatusPayload {
  is_online: boolean
}

// Тариф больше не выбирается водителем — бэкенд сам выводит categories
// из каталога машин по марке/модели/году. Исключение — мототакси:
// каталог не используется, category: 'moto' передаётся явно.
export interface DriverVehiclePayload {
  category?: VehicleCategory
  color: string
  make: string
  model: string
  plate_number: string
  year: number
}

export interface DriverVehicle extends DriverVehiclePayload {
  // category — легаси-скаляр (старший из categories).
  category: VehicleCategory
  categories?: VehicleCategory[]
  driver_id: string
  id: string
}

export interface DriverLocationPayload {
  heading?: number
  lat: number
  lng: number
  speed?: number
}

export interface DriverTripActionResponse {
  message: string
}

// Пассажир просит заехать ещё в одно место по пути. Пока водитель не ответил,
// маршрут и цена поездки не меняются.
export interface DriverRouteChange {
  created_at: string
  distance_km: number
  duration_min: number
  // Доплата пассажира за крюк, посчитанная бэкендом от снапшота тарифа поездки.
  // Ту же цифру видит пассажир — она согласована обеими сторонами до согласия.
  fee: number
  id: string
  status: 'accepted' | 'cancelled' | 'pending' | 'rejected'
  // ПОЛНЫЙ новый список остановок, а не одна добавленная: бэкенд хранит и
  // применяет его целиком. Та, куда просят заехать, — последняя.
  stops: TripStop[]
  trip_id: string
}

export interface DriverPendingRouteChangeResponse {
  route_change: DriverRouteChange | null
}

export interface DriverEarnings {
  total_earned: number
  // Разбивка чистого дохода: наличными (пассажир платил в руки) и картой/кошельком.
  cash_earned: number
  card_earned: number
  trip_count: number
}

export interface DriverWallet {
  available_balance: number
  debt_balance: number
  min_balance_to_go_online: number
}

export interface DriverWalletTopUpPayload {
  amount: number
}

export interface DriverWalletTopUpResponse {
  redirect_url: string
}

// Минимальная сумма заявки на вывод (KZT) — как entity.MinPayoutAmount на бэке.
export const MIN_PAYOUT_AMOUNT = 1000

export type PayoutStatus = 'paid' | 'pending' | 'rejected'

export interface DriverPayoutPayload {
  amount: number
  // destination — реквизиты получателя (номер карты или IBAN)
  destination: string
}

export interface PayoutRequest {
  id: string
  requester_type: 'driver' | 'park'
  driver_id: null | string
  park_id: null | string
  amount: number
  destination: string
  status: PayoutStatus
  rejection_reason: null | string
  reviewed_at: null | string
  created_at: string
}

export interface DriverPayoutsResponse {
  payouts: PayoutRequest[]
}

export interface RatePassengerPayload {
  score: number
  comment?: string
  // Чипы-теги отзыва (слаги из constants/ratingTags.ts).
  tags?: string[]
}

export interface DriverPhoneOtpResponse {
  message: string
  phone: string
}

export interface DriverPhoneVerifyResponse {
  message: string
  phone: string
  // merged: true — номер принадлежал другому аккаунту, аккаунты объединены и
  // сессия перевыпущена. После этого нужно перечитать сессию.
  merged?: boolean
}
