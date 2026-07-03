import type { Trip } from '~/types/trips'

export function formatRevenue(amount: number): string {
  return `${Math.round(amount).toLocaleString('ru-RU')} ₸`
}

export function formatFare(trip: Trip): string {
  return formatRevenue(trip.final_fare ?? trip.estimated_fare)
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('ru-RU', options ?? {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

// Время без даты — для лент сообщений (чат поддержки, чат парка).
export function formatTime(value: string): string {
  return formatDate(value, { hour: '2-digit', minute: '2-digit' })
}

// Короткий идентификатор для UI — первые 8 символов UUID.
export function shortId(value: string): string {
  return value.slice(0, 8)
}
