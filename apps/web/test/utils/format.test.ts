import { describe, expect, it } from 'vitest'
import { formatDate, formatFare, formatRevenue, formatTime, shortId } from '~/utils/format'

// Разделитель разрядов в ru-RU — неразрывный пробел, а его код-поинт зависит
// от версии ICU. Нормализуем любой пробел к обычному, чтобы тест не был хрупким.
function norm(value: string): string {
  return value.replace(/\s+/g, ' ')
}

describe('formatRevenue', () => {
  it('округляет и добавляет ₸ с группировкой разрядов', () => {
    expect(norm(formatRevenue(1234.6))).toBe('1 235 ₸')
    expect(norm(formatRevenue(0))).toBe('0 ₸')
  })
})

describe('formatFare', () => {
  it('предпочитает final_fare, когда он задан', () => {
    expect(norm(formatFare({ estimated_fare: 500, final_fare: 800 } as never))).toBe('800 ₸')
  })

  it('откатывается к estimated_fare, когда final_fare null', () => {
    expect(norm(formatFare({ estimated_fare: 500, final_fare: null } as never))).toBe('500 ₸')
  })
})

describe('formatTime', () => {
  it('форматирует ISO-таймстамп как HH:MM (без даты, устойчиво к таймзоне)', () => {
    expect(formatTime('2024-01-01T09:05:00Z')).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('formatDate', () => {
  it('принимает пользовательские Intl-опции', () => {
    // Полдень UTC 15 июня безопасен для любой таймзоны в пределах ±14ч.
    expect(formatDate('2024-06-15T12:00:00Z', { year: 'numeric' })).toBe('2024')
  })
})

describe('shortId', () => {
  it('берёт первые 8 символов', () => {
    expect(shortId('abcdefghijklmnop')).toBe('abcdefgh')
  })

  it('возвращает строку целиком, если она короче 8', () => {
    expect(shortId('abc')).toBe('abc')
  })
})
