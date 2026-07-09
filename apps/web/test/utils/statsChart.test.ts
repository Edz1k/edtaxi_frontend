import { describe, expect, it } from 'vitest'
import { dayBucketLabels, formatCompactNumber, formatWholeNumber, monthBucketLabels, niceCeil, pluralRu } from '~/utils/statsChart'

describe('dayBucketLabels', () => {
  it('строит короткую и полную подписи дня', () => {
    expect(dayBucketLabels('2026-07-09')).toEqual({ fullLabel: '9 июля', label: '9' })
  })

  it('не съезжает на день из-за UTC-парсинга', () => {
    // new Date('YYYY-MM-DD') дал бы полночь UTC — в отрицательных таймзонах
    // это предыдущий день; ключ разбирается вручную как локальная дата.
    expect(dayBucketLabels('2026-01-01').label).toBe('1')
  })
})

describe('monthBucketLabels', () => {
  it('строит короткую и полную подписи месяца', () => {
    // Для мая/июня/июля ICU не сокращает название — там label совпадает с полным.
    expect(monthBucketLabels('2026-01')).toEqual({ fullLabel: 'Январь 2026 г.', label: 'янв' })
    expect(monthBucketLabels('2026-07').fullLabel).toBe('Июль 2026 г.')
  })
})

describe('niceCeil', () => {
  it('округляет вверх до «круглых» значений', () => {
    expect(niceCeil(0)).toBe(1)
    expect(niceCeil(7)).toBe(8)
    expect(niceCeil(94)).toBe(100)
    expect(niceCeil(140)).toBe(150)
    expect(niceCeil(50_000)).toBe(50_000)
  })
})

describe('formatCompactNumber', () => {
  it('сокращает крупные значения', () => {
    expect(formatCompactNumber(50_000)).toContain('тыс')
    expect(formatCompactNumber(999)).toBe('999')
  })
})

describe('formatWholeNumber', () => {
  it('разделяет разряды', () => {
    // Intl для ru-RU использует неразрывный пробел.
    expect(formatWholeNumber(12_345)).toBe('12 345')
  })
})

describe('pluralRu', () => {
  const forms: [string, string, string] = ['заказ', 'заказа', 'заказов']

  it.each([
    [1, '1 заказ'],
    [2, '2 заказа'],
    [5, '5 заказов'],
    [11, '11 заказов'],
    [21, '21 заказ'],
    [104, '104 заказа'],
  ])('%i → %s', (count, expected) => {
    expect(pluralRu(count, forms)).toBe(expected)
  })
})
