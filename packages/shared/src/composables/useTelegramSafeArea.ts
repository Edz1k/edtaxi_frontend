import { isTMA, viewport } from '@telegram-apps/sdk'
import { onMounted, readonly, ref } from 'vue'
import { initTelegramSdk } from './telegram/sdk'

let stopViewportCssVars: VoidFunction | undefined
let stopFullscreenClassSync: VoidFunction | undefined
let mountPromise: Promise<void> | undefined

function syncFullscreenClass(isFullscreen: boolean) {
  document.documentElement.classList.toggle('tg-fullscreen', isFullscreen)
}

export async function mountTelegramSafeArea() {
  if (typeof window === 'undefined')
    return false

  if (!isTMA())
    return false

  initTelegramSdk()

  if (!viewport.isMounted() && !viewport.isMounting()) {
    mountPromise = viewport.mount.isAvailable()
      ? viewport.mount({ timeout: 3000 }).catch((err) => {
          mountPromise = undefined
          throw err
        })
      : undefined
  }

  await mountPromise

  viewport.expand.ifAvailable()

  if (!stopViewportCssVars && viewport.bindCssVars.isAvailable())
    stopViewportCssVars = viewport.bindCssVars()

  if (!stopFullscreenClassSync) {
    syncFullscreenClass(viewport.isFullscreen())
    stopFullscreenClassSync = viewport.isFullscreen.sub(syncFullscreenClass)
  }

  return true
}

export function useTelegramSafeArea() {
  const isReady = ref(false)

  onMounted(async () => {
    try {
      isReady.value = await mountTelegramSafeArea()
    }
    catch {
      isReady.value = false
    }
  })

  return {
    isReady: readonly(isReady),
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopViewportCssVars?.()
    stopFullscreenClassSync?.()
    stopViewportCssVars = undefined
    stopFullscreenClassSync = undefined
    mountPromise = undefined
  })
}
