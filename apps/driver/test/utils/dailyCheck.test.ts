import type { DailyCheck, DriverVerificationsResponse } from '~/types/driver'
import { describe, expect, it } from 'vitest'
import { dailyCheckState, isDailyCheckValid, validUntilLabel } from '~/utils/dailyCheck'

const NOW = new Date('2026-07-20T12:00:00Z').getTime()

function verification(patch: Partial<DriverVerificationsResponse> = {}): DriverVerificationsResponse {
  return {
    face_verified: true,
    face_status: 'approved',
    face_photo_url: null,
    has_approved_vehicle: true,
    daily_check_valid: false,
    vehicles: [],
    ...patch,
  }
}

function latest(patch: Partial<DailyCheck> = {}): DailyCheck {
  return {
    id: 'check-1',
    driver_id: 'driver-1',
    vehicle_id: 'vehicle-1',
    selfie_url: 'daily-checks/a.jpg',
    vehicle_photo_url: 'daily-checks/b.jpg',
    status: 'approved',
    rejection_reason: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-07-20T09:00:00Z',
    ...patch,
  }
}

describe('isDailyCheckValid', () => {
  it('действует, пока не наступил daily_check_valid_until', () => {
    const v = verification({
      daily_check_valid: true,
      daily_check_valid_until: '2026-07-20T18:00:00Z',
    })
    expect(isDailyCheckValid(v, NOW)).toBe(true)
  })

  // Ради этого случая и заводится клиентский тикер: сервер ещё присылает
  // daily_check_valid=true, но срок уже вышел.
  it('срок истёк — невалидна, даже если сервер прислал daily_check_valid', () => {
    const v = verification({
      daily_check_valid: true,
      daily_check_valid_until: '2026-07-20T11:59:00Z',
    })
    expect(isDailyCheckValid(v, NOW)).toBe(false)
  })

  it('старый бэкенд без valid_until — опираемся на серверный флаг', () => {
    expect(isDailyCheckValid(verification({ daily_check_valid: true }), NOW)).toBe(true)
  })

  it('битый valid_until не роняет проверку', () => {
    const v = verification({ daily_check_valid: true, daily_check_valid_until: 'не дата' })
    expect(isDailyCheckValid(v, NOW)).toBe(true)
  })

  it('нет верификации — невалидна', () => {
    expect(isDailyCheckValid(null, NOW)).toBe(false)
  })
})

describe('dailyCheckState', () => {
  it('действующая проверка → valid', () => {
    const v = verification({
      daily_check_valid: true,
      daily_check_valid_until: '2026-07-20T18:00:00Z',
      latest_daily_check: latest(),
    })
    expect(dailyCheckState(v, NOW)).toBe('valid')
  })

  it('отправленная заявка → pending, даже если прошлая проверка истекла', () => {
    const v = verification({ latest_daily_check: latest({ status: 'pending' }) })
    expect(dailyCheckState(v, NOW)).toBe('pending')
  })

  it('сгоревшая заявка → expired', () => {
    const v = verification({ latest_daily_check: latest({ status: 'expired' }) })
    expect(dailyCheckState(v, NOW)).toBe('expired')
  })

  it('отклонённая заявка → rejected', () => {
    const v = verification({
      latest_daily_check: latest({ status: 'rejected', rejection_reason: 'Селфи не читается' }),
    })
    expect(dailyCheckState(v, NOW)).toBe('rejected')
  })

  it('одобрена, но срок вышел → missing (нужна новая проверка)', () => {
    const v = verification({
      daily_check_valid: true,
      daily_check_valid_until: '2026-07-20T11:00:00Z',
      latest_daily_check: latest({ status: 'approved' }),
    })
    expect(dailyCheckState(v, NOW)).toBe('missing')
  })

  it('проверок не было → missing', () => {
    expect(dailyCheckState(verification(), NOW)).toBe('missing')
    expect(dailyCheckState(null, NOW)).toBe('missing')
  })
})

describe('validUntilLabel', () => {
  it('форматирует время в HH:MM', () => {
    expect(validUntilLabel('2026-07-20T18:40:00Z')).toMatch(/^\d{2}:\d{2}$/)
  })

  it('пусто, когда момента нет или он битый', () => {
    expect(validUntilLabel(null)).toBe('')
    expect(validUntilLabel(undefined)).toBe('')
    expect(validUntilLabel('не дата')).toBe('')
  })
})
