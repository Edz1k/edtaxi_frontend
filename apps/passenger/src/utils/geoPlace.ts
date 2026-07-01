import type { GeoPlace } from '@edtaxi/shared/types/geocoding'

interface TripCoords {
  id: string
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
}

export function tripPickupPlace(trip: TripCoords): GeoPlace {
  return {
    address: trip.pickup_address,
    id: `pickup:${trip.id}`,
    lat: trip.pickup_lat,
    lng: trip.pickup_lng,
    name: trip.pickup_address,
  }
}

export function tripDropoffPlace(trip: TripCoords): GeoPlace {
  return {
    address: trip.dropoff_address,
    id: `dropoff:${trip.id}`,
    lat: trip.dropoff_lat,
    lng: trip.dropoff_lng,
    name: trip.dropoff_address,
  }
}
