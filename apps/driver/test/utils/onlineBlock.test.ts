import { describe, expect, it } from 'vitest'
import { onlineBlockTargetFor } from '~/utils/onlineBlock'

// Тексты — ровно те, что отдаёт mapDriverError на 403 (internal/transport/http/
// handler/driver.go). Если формулировки на бэке поменяются, падать должно здесь,
// а не тихо уводить водителя не на тот экран.
describe('onlineBlockTargetFor', () => {
  it('нет таксопарка → список парков', () => {
    expect(onlineBlockTargetFor('Вступите в таксопарк, чтобы выйти на линию')).toBe('park')
  })

  it('просрочен фотоконтроль → экран фотоконтроля', () => {
    expect(onlineBlockTargetFor('Пройдите фотоконтроль, чтобы выйти на линию')).toBe('daily-check')
  })

  it('не проверена личность → онбординг', () => {
    expect(onlineBlockTargetFor('Пройдите проверку личности, чтобы выйти на линию')).toBe('verification')
  })

  it('машина не проверена → онбординг', () => {
    expect(onlineBlockTargetFor('Добавьте машину и дождитесь её проверки, чтобы выйти на линию')).toBe('verification')
  })

  it('незнакомая причина → онбординг как безопасный дефолт', () => {
    expect(onlineBlockTargetFor('Выход на линию сейчас недоступен.')).toBe('verification')
    expect(onlineBlockTargetFor('')).toBe('verification')
  })
})
