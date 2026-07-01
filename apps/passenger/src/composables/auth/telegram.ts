import { miniAppReady, openLink, retrieveRawInitData } from '@telegram-apps/sdk'
import { initTelegramSdk } from '~/composables/telegram/sdk'

interface TelegramWebApp {
  expand?: () => void
  initData?: string
  ready?: () => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export function getTelegramInitData() {
  if (typeof window === 'undefined')
    return ''

  const currentWebAppInitData = window.Telegram?.WebApp?.initData

  if (currentWebAppInitData)
    return currentWebAppInitData

  try {
    initTelegramSdk()
    return retrieveRawInitData() ?? ''
  }
  catch {
    return ''
  }
}

export function isTelegramWebApp() {
  return Boolean(getTelegramInitData())
}

export function readyTelegramWebApp() {
  if (typeof window === 'undefined')
    return

  try {
    initTelegramSdk()
    miniAppReady()
  }
  catch {
    window.Telegram?.WebApp?.ready?.()
  }
}

// openExternalLink открывает платёжную/прочую внешнюю ссылку (например окно
// оплаты Freedom Pay) во внешнем браузере — внутри Telegram-вебвью платёжные
// формы банков часто не работают корректно. Вне Telegram — обычный переход.
export function openExternalLink(url: string) {
  if (typeof window === 'undefined')
    return

  try {
    initTelegramSdk()
    if (openLink.isAvailable()) {
      openLink(url)
      return
    }
  }
  catch {
    // падаем в обычный переход ниже
  }

  window.open(url, '_blank')
}
