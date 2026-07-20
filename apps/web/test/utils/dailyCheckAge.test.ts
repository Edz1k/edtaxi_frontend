import { describe, expect, it } from 'vitest'
import { ageLabel, DAILY_CHECK_PENDING_TTL_MS, expiresInLabel, urgency } from '~/utils/dailyCheckAge'

const NOW = new Date('2026-07-20T12:00:00Z').getTime()

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString()
}

describe('ageLabel', () => {
  it('свежая заявка — «только что»', () => {
    expect(ageLabel(minutesAgo(0), NOW)).toBe('только что')
    expect(ageLabel(minutesAgo(0.5), NOW)).toBe('только что')
  })

  it('минуты', () => {
    expect(ageLabel(minutesAgo(12), NOW)).toBe('12 мин назад')
    expect(ageLabel(minutesAgo(59), NOW)).toBe('59 мин назад')
  })

  it('часы с минутами и без', () => {
    expect(ageLabel(minutesAgo(60), NOW)).toBe('1 ч назад')
    expect(ageLabel(minutesAgo(125), NOW)).toBe('2 ч 5 мин назад')
  })

  // Часы на машине поддержки могут отставать от серверных — «-3 мин назад»
  // выглядело бы поломкой.
  it('заявка из будущего не даёт отрицательный возраст', () => {
    expect(ageLabel(new Date(NOW + 120_000).toISOString(), NOW)).toBe('только что')
  })

  it('битая дата — пустая строка', () => {
    expect(ageLabel('не дата', NOW)).toBe('')
  })
})

describe('urgency', () => {
  it('свежая заявка — обычная', () => {
    expect(urgency(minutesAgo(10), NOW)).toBe('normal')
  })

  it('меньше часа до сгорания — срочная', () => {
    // TTL 3 часа: заявке 2ч10м, осталось 50 минут.
    expect(urgency(minutesAgo(130), NOW)).toBe('urgent')
  })

  it('ровно на границе часа — уже срочная', () => {
    expect(urgency(minutesAgo(120), NOW)).toBe('urgent')
  })

  it('старше TTL — сгоревшая', () => {
    expect(urgency(minutesAgo(181), NOW)).toBe('expired')
  })

  it('недельная заявка — сгоревшая', () => {
    expect(urgency(new Date(NOW - 7 * 24 * 3600_000).toISOString(), NOW)).toBe('expired')
  })

  it('срок жизни можно переопределить', () => {
    expect(urgency(minutesAgo(90), NOW, 60 * 60_000)).toBe('expired')
  })

  it('битая дата не помечается срочной', () => {
    expect(urgency('не дата', NOW)).toBe('normal')
  })
})

describe('expiresInLabel', () => {
  it('в спокойной очереди счётчик не шумит', () => {
    expect(expiresInLabel(minutesAgo(10), NOW)).toBe('')
  })

  it('перед сгоранием показывает остаток', () => {
    expect(expiresInLabel(minutesAgo(155), NOW)).toBe('сгорит через 25 мин')
  })

  it('после TTL — «срок истёк»', () => {
    expect(expiresInLabel(minutesAgo(200), NOW)).toBe('срок истёк')
  })

  it('срок жизни заявки совпадает с бэкендом (3 часа)', () => {
    expect(DAILY_CHECK_PENDING_TTL_MS).toBe(3 * 60 * 60 * 1000)
  })
})
