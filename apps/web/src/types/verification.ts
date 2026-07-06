export type VerificationStatus = 'approved' | 'pending' | 'rejected'

export interface PendingVehicle {
  id: string
  driver_id: string
  // driver_* подтягиваются бэкендом, чтобы показывать имя водителя вместо UUID
  // и давать ссылку в его кабинет (driver_user_id).
  driver_name?: string
  driver_phone?: string
  driver_user_id?: string
  category: string
  // Категории, выведенные сервером из каталога машин.
  categories?: string[]
  plate_number: string
  make: string
  model: string
  year: number
  color: string
  is_active: boolean
  verification_status: VerificationStatus
  // Пер-блочные вердикты чек-листа: фото машины / документы + причина отказа.
  photos_check?: VerificationStatus
  docs_check?: VerificationStatus
  rejection_reason?: null | string
  verification_photo_url: null | string
  tech_passport_photo_url?: null | string
  // Фотоотчёт по слотам; старые заявки приходят без него.
  photos?: Array<{ slot: string, photo_url: string }>
  reviewed_by: null | string
  reviewed_at: null | string
  created_at: string
}

export interface DailyCheck {
  id: string
  driver_id: string
  driver_name?: string
  driver_phone?: string
  driver_user_id?: string
  vehicle_id: string
  selfie_url: null | string
  vehicle_photo_url: null | string
  driver_face_photo_url: null | string
  // Удостоверение с онбординга + заявленный ИИН — для сверки лица и документа
  // тех.поддержкой прямо на ежедневной проверке.
  driver_id_document_url: null | string
  driver_iin?: null | string
  vehicle_tech_passport_photo_url: null | string
  status: VerificationStatus
  // Пер-блочные вердикты чек-листа дэйлика: селфи / фото машины.
  selfie_check?: VerificationStatus
  vehicle_check?: VerificationStatus
  rejection_reason: null | string
  reviewed_by: null | string
  reviewed_at: null | string
  created_at: string
}

// Заявка на верификацию лица водителя (одноразовая): селфи + документ.
export interface FaceVerification {
  driver_id: string
  driver_user_id: string
  driver_name: string
  driver_phone: string
  face_photo_url: null | string
  id_document_url: null | string
  // ИИН, заявленный водителем; бэкенд уже проверил контрольную сумму, фронт
  // повторяет проверку для наглядного бейджа рядом с документом.
  iin?: null | string
  created_at: string
}

export interface FacesResponse {
  faces: FaceVerification[]
}

export interface VehiclesResponse {
  vehicles: PendingVehicle[]
}

export interface DailyChecksResponse {
  daily_checks: DailyCheck[]
}
