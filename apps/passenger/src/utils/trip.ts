import type { TripStatus } from '~/types/trips'
import { TERMINAL_TRIP_STATUSES } from '~/types/trips'

export function isTerminalTripStatus(status: TripStatus): boolean {
  return TERMINAL_TRIP_STATUSES.includes(status as typeof TERMINAL_TRIP_STATUSES[number])
}
