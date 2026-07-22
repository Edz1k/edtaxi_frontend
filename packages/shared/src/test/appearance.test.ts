import { describe, expect, it } from 'vitest'
import { resolveTheme } from '../composables/appearance'

// Правила резолва темы:
// - явный выбор пользователя ('dark' | 'light') побеждает всегда;
// - 'auto' следует теме Telegram-клиента, при её отсутствии — prefers-color-scheme;
// - нет ни того ни другого → 'dark' (апы задизайнены тёмными, это безопасный фолбэк).
describe('resolveTheme', () => {
  it('явный выбор игнорирует окружение', () => {
    expect(resolveTheme('dark', 'light', false)).toBe('dark')
    expect(resolveTheme('light', 'dark', true)).toBe('light')
  })

  it('auto следует теме Telegram-клиента', () => {
    expect(resolveTheme('auto', 'light', true)).toBe('light')
    expect(resolveTheme('auto', 'dark', false)).toBe('dark')
  })

  it('auto без Telegram падает на prefers-color-scheme', () => {
    expect(resolveTheme('auto', null, true)).toBe('dark')
    expect(resolveTheme('auto', null, false)).toBe('light')
  })

  it('auto без каких-либо сигналов — тёмная (дизайн-дефолт приложений)', () => {
    expect(resolveTheme('auto', null, null)).toBe('dark')
  })

  it('мусорное значение из localStorage трактуется как auto', () => {
    expect(resolveTheme('neon' as never, 'light', null)).toBe('light')
    expect(resolveTheme('' as never, null, null)).toBe('dark')
  })
})
