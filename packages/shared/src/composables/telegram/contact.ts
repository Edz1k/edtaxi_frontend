import { requestContactComplete } from '@telegram-apps/sdk'
import { isTelegramWebApp } from '../auth/telegram'
import { initTelegramSdk } from './sdk'

// Запрос собственного контакта пользователя через нативный диалог Telegram
// («Поделиться номером телефона?»). Возвращает СЫРОЙ подписанный payload
// ("contact=...&auth_date=...&hash=...") — его подпись проверяет бэкенд
// (POST /auth/phone/telegram), поэтому парсить его на фронте не нужно.
// Всё обёрнуто в try/catch и возвращает null при любой проблеме (старый
// клиент Telegram, пользователь отказал) — вызывающий код предлагает
// ввести номер вручную с подтверждением по OTP.

export function isTelegramContactSupported(): boolean {
  try {
    initTelegramSdk()
    return isTelegramWebApp() && requestContactComplete.isAvailable()
  }
  catch {
    return false
  }
}

export async function requestTelegramContact(): Promise<null | string> {
  if (!isTelegramContactSupported())
    return null

  try {
    const { raw } = await requestContactComplete()
    return raw || null
  }
  catch {
    return null
  }
}
