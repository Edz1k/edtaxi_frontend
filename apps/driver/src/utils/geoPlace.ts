import type { GeoPlace } from '@edtaxi/shared/types/geocoding'
import type { DriverTripOffer } from '~/types/websocket'

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
