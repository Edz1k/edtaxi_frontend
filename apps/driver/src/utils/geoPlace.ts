import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { DriverTripOffer } from '~/types/websocket'

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

export function offerToPlace(offer: DriverTripOffer | null, type: 'dropoff' | 'pickup'): GeoPlace | null {
  if (!offer)
    return null

  const lat = type === 'pickup' ? offer.pickup_lat : offer.dropoff_lat
  const lng = type === 'pickup' ? offer.pickup_lng : offer.dropoff_lng
  const address = type === 'pickup' ? offer.pickup_address : offer.dropoff_address

  if (typeof lat !== 'number' || typeof lng !== 'number')
    return null

  return {
    address,
    id: `${type}:${lat}:${lng}`,
    lat,
    lng,
    name: address,
  }
}
