// Заявка водителя на добавление его модели в каталог машин (TODO п.10).
export type CarCatalogRequestStatus = 'pending' | 'approved' | 'rejected'

export interface CarCatalogRequest {
  id: string
  make: string
  model: string
  year: number
  comment: string
  status: CarCatalogRequestStatus
  rejection_reason: string
  created_at: string
}

export interface CarRequestsResponse {
  requests: CarCatalogRequest[]
}

export interface SubmitCarRequestPayload {
  make: string
  model: string
  year: number
  comment?: string
}
