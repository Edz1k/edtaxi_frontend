import { init } from '@telegram-apps/sdk'

let initialized = false

export function initTelegramSdk() {
  if (initialized || typeof window === 'undefined')
    return

  init()
  initialized = true
}
