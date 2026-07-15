import { describe, expect, it } from 'vitest'
import { buildParkChangePayload } from '~/utils/park'

// Парк с комиссией 1.5% (хранится долей: 0.015).
const park = { bin: '123456789012', commission_rate: 0.015 }

describe('buildParkChangePayload', () => {
  it('возвращает пустой payload, если ничего не изменилось', () => {
    expect(buildParkChangePayload(park, { bin: '123456789012', commission_rate_pct: 1.5 })).toEqual({})
  })

  it('игнорирует пробелы вокруг БИН при сравнении', () => {
    expect(buildParkChangePayload(park, { bin: '  123456789012  ', commission_rate_pct: 1.5 })).toEqual({})
  })

  it('включает только изменённый БИН (триммированный)', () => {
    expect(buildParkChangePayload(park, { bin: ' 999999999999 ', commission_rate_pct: 1.5 }))
      .toEqual({ bin: '999999999999' })
  })

  it('не включает пустой БИН — очистить поле нельзя', () => {
    expect(buildParkChangePayload(park, { bin: '   ', commission_rate_pct: 1.5 })).toEqual({})
  })

  it('конвертирует изменённую комиссию из процентов в долю', () => {
    expect(buildParkChangePayload(park, { bin: '123456789012', commission_rate_pct: 2.5 }))
      .toEqual({ commission_rate: 0.025 })
  })

  it('округляет долю до 4 знаков (шаг 0.1%)', () => {
    expect(buildParkChangePayload(park, { bin: '123456789012', commission_rate_pct: 1.1 }))
      .toEqual({ commission_rate: 0.011 })
  })

  it('включает оба поля, когда изменены оба', () => {
    expect(buildParkChangePayload(park, { bin: '999999999999', commission_rate_pct: 3 }))
      .toEqual({ bin: '999999999999', commission_rate: 0.03 })
  })

  it('работает с парком без БИН (null)', () => {
    expect(buildParkChangePayload({ bin: null, commission_rate: 0.015 }, { bin: '123456789012', commission_rate_pct: 1.5 }))
      .toEqual({ bin: '123456789012' })
  })
})
