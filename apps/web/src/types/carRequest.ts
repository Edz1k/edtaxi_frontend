export type CarCatalogRequestStatus = 'pending' | 'approved' | 'rejected'

// max_class каталога — только эти 5 значений (CHECK car_catalog.max_class);
// «Мото»/«Минивэн» из общего CATEGORY_LABELS сюда не входят.
export type CatalogMaxClass = 'economy' | 'comfort' | 'business' | 'comfort_plus' | 'business_plus'

export interface CarCatalogRequestItem {
  id: string
  make: string
  model: string
  year: number
  comment: string
  status: CarCatalogRequestStatus
  rejection_reason: string
  user_name: string
  phone: string
  driver_user_id: string
  created_at: string
  reviewed_at: null | string
}

export interface CarRequestsListResponse {
  requests: CarCatalogRequestItem[]
  total: number
  limit: number
  offset: number
}

// Тело одобрения = строка каталога, которую создаёт саппорт (предзаполнено из
// заявки, но редактируемо). year_to == null — «по настоящее время».
export interface ApproveCarRequestPayload {
  make: string
  model: string
  year_from: number
  year_to: null | number
  max_class: CatalogMaxClass | null
  is_minivan: boolean
}
