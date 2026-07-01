export interface PassengerProfile {
  avatar_url: null | string
  first_name: null | string
  id: string
  last_name: null | string
  phone: string
}

export interface UpdatePassengerProfilePayload {
  avatar_url?: null | string
  first_name?: null | string
  last_name?: null | string
}
