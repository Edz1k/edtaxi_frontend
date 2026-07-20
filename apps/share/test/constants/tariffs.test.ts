import { describe, expect, it } from 'vitest'
import { TARIFF_META, tariffLabel } from '~/constants/tariffs'

describe('название тарифа на share-странице', () => {
  it('знает базовые категории', () => {
    expect(tariffLabel('economy')).toBe('Эконом')
    expect(tariffLabel('minivan')).toBe('Минивэн')
  })

  // Хантакси и мопед появились в п.30, а share про них не знал — поездка в
  // такой категории роняла страницу белым экраном на TARIFF_META[...].label.
  it('знает категории, добавленные в п.30', () => {
    expect(tariffLabel('comfort_plus')).toBe('Комфорт+')
    expect(tariffLabel('business_plus')).toBe('Бизнес+')
    expect(tariffLabel('moped')).toBe('Мопед')
  })

  // Тип VehicleCategory этого не ловит: ответ API в него просто приводится.
  // Следующая категория на бэке не должна снова ронять страницу.
  it('не падает на незнакомой категории', () => {
    expect(() => tariffLabel('helicopter')).not.toThrow()
    expect(tariffLabel('helicopter')).toBe('Тариф')
  })

  it('переживает пустое значение', () => {
    expect(tariffLabel('')).toBe('Тариф')
  })

  // Справочник и тип обязаны совпадать: разъехавшись, они дают ровно ту дыру,
  // из-за которой всё и падало.
  it('справочник покрывает все категории типа', () => {
    const expected = ['business', 'business_plus', 'comfort', 'comfort_plus', 'economy', 'minivan', 'moped', 'moto']

    expect(Object.keys(TARIFF_META).sort()).toEqual(expected)
  })
})
