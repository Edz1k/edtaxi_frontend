import type { Trip } from '~/types/trips'
import { describe, expect, it } from 'vitest'
import {
  buildEarningsBuckets,
  DAY_BUCKET_COUNT,
  formatTripCount,
  MONTH_BUCKET_COUNT,
  niceCeil,
} from '~/utils/earningsChart'

// Фиксированное «сейчас», чтобы окна корзин не зависели от дня запуска тестов.
const NOW = new Date(2026, 6, 9, 12)

let tripSeq = 0

function makeTrip(overrides: Partial<Trip>): Trip {
  tripSeq += 1
  return {
    category: 'economy',
    distance_km: 5,
    dropoff_address: 'B',
    dropoff_lat: 0,
    dropoff_lng: 0,
    duration_min: 10,
    estimated_fare: 900,
    final_fare: 1000,
    id: `trip-${tripSeq}`,
    pickup_address: 'A',
    pickup_lat: 0,
    pickup_lng: 0,
    status: 'completed',
    surge_multiplier: 1,
    ...overrides,
  }
}

function completedAt(year: number, month: number, day: number, hour = 12) {
  return new Date(year, month - 1, day, hour).toISOString()
}

describe('buildEarningsBuckets', () => {
  it('строит непрерывное окно из 14 дней, заканчивающееся сегодня', () => {
    const buckets = buildEarningsBuckets([], 'day', NOW)

    expect(buckets).toHaveLength(DAY_BUCKET_COUNT)
    expect(buckets.at(-1)!.key).toBe('2026-07-09')
    expect(buckets[0].key).toBe('2026-06-26')
    expect(buckets.every(bucket => bucket.total === 0 && bucket.tripCount === 0)).toBe(true)
  })

  it('суммирует завершённые поездки в корзину своего дня', () => {
    const trips = [
      makeTrip({ completed_at: completedAt(2026, 7, 9), final_fare: 1500 }),
      makeTrip({ completed_at: completedAt(2026, 7, 9), final_fare: 500 }),
      makeTrip({ completed_at: completedAt(2026, 7, 1), final_fare: 700 }),
    ]

    const buckets = buildEarningsBuckets(trips, 'day', NOW)
    const today = buckets.at(-1)!
    const firstJuly = buckets.find(bucket => bucket.key === '2026-07-01')!

    expect(today.total).toBe(2000)
    expect(today.tripCount).toBe(2)
    expect(firstJuly.total).toBe(700)
  })

  it('игнорирует незавершённые поездки и поездки без completed_at, старые — вне окна', () => {
    const trips = [
      makeTrip({ completed_at: completedAt(2026, 7, 9), final_fare: 9000, status: 'cancelled' }),
      makeTrip({ completed_at: null, final_fare: 9000 }),
      makeTrip({ completed_at: completedAt(2026, 5, 1), final_fare: 9000 }),
    ]

    const buckets = buildEarningsBuckets(trips, 'day', NOW)

    expect(buckets.every(bucket => bucket.total === 0)).toBe(true)
  })

  it('подставляет estimated_fare, когда final_fare отсутствует', () => {
    const trips = [makeTrip({ completed_at: completedAt(2026, 7, 9), estimated_fare: 800, final_fare: null })]

    const buckets = buildEarningsBuckets(trips, 'day', NOW)

    expect(buckets.at(-1)!.total).toBe(800)
  })

  it('строит окно из 12 месяцев и учитывает границы месяца', () => {
    const trips = [
      makeTrip({ completed_at: completedAt(2026, 7, 1, 0), final_fare: 100 }),
      makeTrip({ completed_at: completedAt(2026, 6, 30, 23), final_fare: 200 }),
      makeTrip({ completed_at: completedAt(2025, 8, 15), final_fare: 300 }),
    ]

    const buckets = buildEarningsBuckets(trips, 'month', NOW)

    expect(buckets).toHaveLength(MONTH_BUCKET_COUNT)
    expect(buckets[0].key).toBe('2025-08')
    expect(buckets.at(-1)!.key).toBe('2026-07')
    expect(buckets.at(-1)!.total).toBe(100)
    expect(buckets.at(-2)!.total).toBe(200)
    expect(buckets[0].total).toBe(300)
  })

  it('по годам — от первой поездки до текущего года', () => {
    const trips = [
      makeTrip({ completed_at: completedAt(2024, 3, 10), final_fare: 400 }),
      makeTrip({ completed_at: completedAt(2026, 1, 2), final_fare: 600 }),
    ]

    const buckets = buildEarningsBuckets(trips, 'year', NOW)

    expect(buckets.map(bucket => bucket.key)).toEqual(['2024', '2025', '2026'])
    expect(buckets[0].total).toBe(400)
    expect(buckets[1].total).toBe(0)
    expect(buckets.at(-1)!.total).toBe(600)
  })

  it('без поездок показывает только текущий год, длинную историю режет до 6 лет', () => {
    expect(buildEarningsBuckets([], 'year', NOW).map(bucket => bucket.key)).toEqual(['2026'])

    const old = [makeTrip({ completed_at: completedAt(2018, 1, 1) })]
    const keys = buildEarningsBuckets(old, 'year', NOW).map(bucket => bucket.key)
    expect(keys).toEqual(['2021', '2022', '2023', '2024', '2025', '2026'])
  })
})

describe('niceCeil', () => {
  it('округляет максимум оси вверх до круглого значения', () => {
    expect(niceCeil(0)).toBe(1)
    expect(niceCeil(950)).toBe(1000)
    expect(niceCeil(1000)).toBe(1000)
    expect(niceCeil(1200)).toBe(1500)
    expect(niceCeil(4800)).toBe(5000)
    expect(niceCeil(12345)).toBe(15000)
  })
})

describe('formatTripCount', () => {
  it('склоняет «поездка» по-русски', () => {
    expect(formatTripCount(1)).toBe('1 поездка')
    expect(formatTripCount(2)).toBe('2 поездки')
    expect(formatTripCount(5)).toBe('5 поездок')
    expect(formatTripCount(11)).toBe('11 поездок')
    expect(formatTripCount(21)).toBe('21 поездка')
    expect(formatTripCount(104)).toBe('104 поездки')
  })
})
