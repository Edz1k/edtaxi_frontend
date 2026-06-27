export interface FavoritePlace {
  address: string
  created_at: string
  id: string
  lat: number
  lng: number
  name: string
  updated_at: string
}

export interface CreatePlacePayload {
  address: string
  lat: number
  lng: number
  name: string
}

export interface UpdatePlacePayload {
  address?: string
  lat?: number
  lng?: number
  name?: string
}
