import type { ApproveCarRequestPayload } from '~/types/carRequest'
import { describe, expect, it } from 'vitest'
import { validateCatalogEntryForm } from '~/utils/carRequestForm'

function entry(overrides: Partial<ApproveCarRequestPayload> = {}): ApproveCarRequestPayload {
  return {
    make: 'BYD',
    model: 'Han',
    year_from: 2020,
    year_to: null,
    max_class: 'comfort',
    is_minivan: false,
    ...overrides,
  }
}

describe('validateCatalogEntryForm', () => {
  it('пропускает валидную запись', () => {
    expect(validateCatalogEntryForm(entry())).toBeNull()
  })

  it('требует марку и модель', () => {
    expect(validateCatalogEntryForm(entry({ make: '  ' }))).toMatch(/марку/i)
    expect(validateCatalogEntryForm(entry({ model: '' }))).toMatch(/модель/i)
  })

  it('требует класс или минивэн', () => {
    expect(validateCatalogEntryForm(entry({ max_class: null, is_minivan: false }))).toMatch(/класс|минивэн/i)
  })

  it('чистый минивэн без класса валиден', () => {
    expect(validateCatalogEntryForm(entry({ max_class: null, is_minivan: true }))).toBeNull()
  })

  it('отбивает год начала до 1990', () => {
    expect(validateCatalogEntryForm(entry({ year_from: 1980 }))).toMatch(/год начала/i)
  })

  it('отбивает год окончания раньше года начала', () => {
    expect(validateCatalogEntryForm(entry({ year_from: 2020, year_to: 2010 }))).toMatch(/окончания/i)
  })

  it('разрешает открытый диапазон (year_to = null)', () => {
    expect(validateCatalogEntryForm(entry({ year_to: null }))).toBeNull()
  })
})
