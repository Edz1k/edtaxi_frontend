import type { Ref } from 'vue'
import { onBeforeUnmount, onMounted, unref } from 'vue'

interface AutoRefreshOptions {
  // Период фонового обновления; 0/undefined — только по возврату на экран.
  intervalMs?: number
  // Реактивный выключатель: false — не поллим (например, статус уже approved).
  enabled?: Ref<boolean> | boolean
  // Дёргать ли run сразу при возврате вкладки/окна в фокус (по умолчанию да).
  refreshOnFocus?: boolean
}

// useAutoRefresh — «живые» данные без ручной кнопки «Обновить»: перезапрашивает
// run() по возврату приложения на экран (visibilitychange/focus) и по таймеру,
// пока вкладка видима. Ошибки run глотаются — фоновое обновление не должно
// показывать тосты поверх работы пользователя.
export function useAutoRefresh(run: () => Promise<unknown> | unknown, options: AutoRefreshOptions = {}) {
  const { enabled = true, intervalMs = 0, refreshOnFocus = true } = options

  let timer: number | undefined
  let inFlight = false

  const isEnabled = () => Boolean(unref(enabled))

  async function tick() {
    if (inFlight || !isEnabled() || typeof document === 'undefined' || document.hidden)
      return
    inFlight = true
    try {
      await run()
    }
    catch {
      // Тихо: следующая попытка придёт по таймеру/фокусу.
    }
    finally {
      inFlight = false
    }
  }

  function onVisible() {
    if (!document.hidden && refreshOnFocus)
      void tick()
  }

  onMounted(() => {
    if (typeof window === 'undefined')
      return

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    if (intervalMs > 0) {
      timer = window.setInterval(() => {
        void tick()
      }, intervalMs)
    }
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onVisible)
    if (timer !== undefined)
      window.clearInterval(timer)
  })

  return { refresh: tick }
}
