import type { DriverTripStep } from '~/types/driver'
import type { Trip, TripStatus } from '~/types/trips'
import type { DriverTripOffer } from '~/types/websocket'
import { TERMINAL_TRIP_STATUSES } from '~/types/trips'

export function isTerminalTripStatus(status: TripStatus): boolean {
  return TERMINAL_TRIP_STATUSES.includes(status as typeof TERMINAL_TRIP_STATUSES[number])
}

export function tripStatusToStep(status: TripStatus): DriverTripStep | null {
  if (status === 'driver_assigned')
    return 'to_pickup'

  if (status === 'driver_arriving')
    return 'arrived'

  if (status === 'in_progress')
    return 'in_progress'

  return null
}

export function tripToOffer(trip: Trip): DriverTripOffer {
  return {
    category: trip.category,
    comment: trip.comment,
    distance_km: trip.distance_km,
    dropoff_address: trip.dropoff_address,
    dropoff_lat: trip.dropoff_lat,
    dropoff_lng: trip.dropoff_lng,
    estimated_fare: trip.final_fare ?? trip.estimated_fare,
    options: trip.options,
    pickup_address: trip.pickup_address,
    pickup_lat: trip.pickup_lat,
    pickup_lng: trip.pickup_lng,
    stops: trip.stops,
    timeout_sec: 0,
    trip_id: trip.id,
  }
}
