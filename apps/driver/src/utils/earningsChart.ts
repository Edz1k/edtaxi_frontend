import type { Trip } from '~/types/trips'

export type EarningsPeriod = 'day' | 'month' | 'year'

export interface EarningsBucket {
  key: string
  /** Короткая подпись под осью X (например «9», «июл», «2026»). */
  label: string
  /** Полная подпись периода для readout и таблицы (например «9 июля»). */
  fullLabel: string
  total: number
  tripCount: number
}

export const DAY_BUCKET_COUNT = 14
export const MONTH_BUCKET_COUNT = 12
export const YEAR_BUCKET_COUNT = 6

const dayFullFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const monthShortFormat = new Intl.DateTimeFormat('ru-RU', { month: 'short' })
const monthFullFormat = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
const compactNumberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, notation: 'compact' })
const tengeFormat = new Intl.NumberFormat('ru-RU', {
  currency: 'KZT',
  maximumFractionDigits: 0,
  style: 'currency',
})

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// Заработок на графике — брутто по завершённым поездкам (final_fare):
// чистый доход по периодам бэкенд пока не отдаёт (driver_transactions без ручки).
function tripAmount(trip: Trip) {
  return trip.final_fare ?? trip.estimated_fare ?? 0
}

function tripKey(trip: Trip, period: EarningsPeriod) {
  const date = new Date(trip.completed_at!)
  if (period === 'day')
    return dayKey(date)
  if (period === 'month')
    return monthKey(date)
  return String(date.getFullYear())
}

function emptyBuckets(period: EarningsPeriod, now: Date, trips: Trip[]): EarningsBucket[] {
  if (period === 'day') {
    return Array.from({ length: DAY_BUCKET_COUNT }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAY_BUCKET_COUNT - 1 - index))
      return {
        fullLabel: dayFullFormat.format(date),
        key: dayKey(date),
        label: String(date.getDate()),
        total: 0,
        tripCount: 0,
      }
    })
  }

  if (period === 'month') {
    return Array.from({ length: MONTH_BUCKET_COUNT }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (MONTH_BUCKET_COUNT - 1 - index), 1)
      return {
        fullLabel: capitalize(monthFullFormat.format(date)),
        key: monthKey(date),
        label: monthShortFormat.format(date).replace('.', ''),
        total: 0,
        tripCount: 0,
      }
    })
  }

  const currentYear = now.getFullYear()
  const earliestYear = trips.reduce(
    (min, trip) => Math.min(min, new Date(trip.completed_at!).getFullYear()),
    currentYear,
  )
  const startYear = Math.max(earliestYear, currentYear - (YEAR_BUCKET_COUNT - 1))
  return Array.from({ length: currentYear - startYear + 1 }, (_, index) => {
    const year = String(startYear + index)
    return {
      fullLabel: `${year} год`,
      key: year,
      label: year,
      total: 0,
      tripCount: 0,
    }
  })
}

/**
 * Раскладывает завершённые поездки по корзинам выбранного периода.
 * Пустые корзины остаются нулевыми — временная ось непрерывна.
 */
export function buildEarningsBuckets(trips: Trip[], period: EarningsPeriod, now = new Date()): EarningsBucket[] {
  const completed = trips.filter(trip => trip.status === 'completed' && trip.completed_at)
  const buckets = emptyBuckets(period, now, completed)
  const byKey = new Map(buckets.map(bucket => [bucket.key, bucket]))

  for (const trip of completed) {
    const bucket = byKey.get(tripKey(trip, period))
    if (!bucket)
      continue
    bucket.total += tripAmount(trip)
    bucket.tripCount += 1
  }

  return buckets
}

/** Округляет максимум оси вверх до «круглого» значения (1 / 1.5 / 2 / 2.5 / … × 10ⁿ). */
export function niceCeil(value: number): number {
  if (value <= 0)
    return 1
  const exp = 10 ** Math.floor(Math.log10(value))
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  for (const step of steps) {
    if (step * exp >= value)
      return step * exp
  }
  return 10 * exp
}

export function formatTenge(value: number) {
  return tengeFormat.format(value)
}

/** Компактная подпись оси: 50 000 → «50 тыс.». */
export function formatCompactNumber(value: number) {
  return compactNumberFormat.format(value)
}

export function formatTripCount(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11)
    return `${count} поездка`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return `${count} поездки`
  return `${count} поездок`
}
