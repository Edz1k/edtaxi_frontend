import type { Trip } from '~/types/trips'

export function formatFare(trip: Trip): string {
  const amount = trip.final_fare ?? trip.estimated_fare
  return `${Math.round(amount).toLocaleString('ru-RU')} ₸`
}

export function formatRevenue(amount: number): string {
  return `${Math.round(amount).toLocaleString('ru-RU')} ₸`
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('ru-RU', options ?? {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value))
}
