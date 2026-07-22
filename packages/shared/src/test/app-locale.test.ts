import { describe, expect, it } from 'vitest'
import { normalizeAppLocale, pickInitialLocale } from '../composables/appLocale'

describe('normalizeAppLocale', () => {
  it('пропускает поддерживаемые локали как есть', () => {
    expect(normalizeAppLocale('ru')).toBe('ru')
    expect(normalizeAppLocale('kk')).toBe('kk')
    expect(normalizeAppLocale('en')).toBe('en')
  })

  it('нормализует регистр и регион (en-US → en)', () => {
    expect(normalizeAppLocale('EN')).toBe('en')
    expect(normalizeAppLocale('en-US')).toBe('en')
    expect(normalizeAppLocale('kk-KZ')).toBe('kk')
  })

  // Telegram отдаёт языковой код 'kk', но 'kz' часто путают с ним —
  // принимаем как казахский, это безвредно.
  it('kz трактуется как казахский', () => {
    expect(normalizeAppLocale('kz')).toBe('kk')
  })

  it('неизвестное/пустое → null', () => {
    expect(normalizeAppLocale('de')).toBeNull()
    expect(normalizeAppLocale('')).toBeNull()
    expect(normalizeAppLocale(undefined)).toBeNull()
  })
})

// Приоритет: сохранённый выбор пользователя → язык Telegram-профиля → русский.
describe('pickInitialLocale', () => {
  it('сохранённый выбор побеждает язык Telegram', () => {
    expect(pickInitialLocale('en', 'kk')).toBe('en')
  })

  it('без сохранённого — язык Telegram-профиля', () => {
    expect(pickInitialLocale('', 'kk')).toBe('kk')
    expect(pickInitialLocale(null, 'en')).toBe('en')
  })

  it('мусор в localStorage не ломает выбор', () => {
    expect(pickInitialLocale('xx', 'kk')).toBe('kk')
  })

  it('ничего нет → русский (дефолт рынка)', () => {
    expect(pickInitialLocale(null, undefined)).toBe('ru')
    expect(pickInitialLocale('', 'de')).toBe('ru')
  })
})
