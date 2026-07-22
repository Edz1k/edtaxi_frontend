import { miniAppReady, openLink, openTelegramLink, retrieveRawInitData } from '@telegram-apps/sdk'
import { initTelegramSdk } from '../telegram/sdk'

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

// openExternalLink открывает внешнюю ссылку во внешнем браузере —
// внутри Telegram-вебвью платёжные формы банков часто не работают корректно.
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

// openTelegramChat уводит из мини-аппа в сам Telegram — например в чат с ботом.
// Именно openTelegramLink, а не openExternalLink: t.me-ссылка через openLink
// уехала бы во внешний браузер, где чат не откроется, а мини-апп останется
// висеть поверх.
export function openTelegramChat(botUsername: string) {
  if (typeof window === 'undefined')
    return

  const url = `https://t.me/${botUsername}`

  try {
    initTelegramSdk()
    if (openTelegramLink.isAvailable()) {
      openTelegramLink(url)
      return
    }
  }
  catch {
    // падаем в обычный переход ниже
  }

  window.open(url, '_blank')
}
