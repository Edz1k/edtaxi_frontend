import { useLocalStorage } from '@vueuse/core'
import { computed, ref, watchEffect } from 'vue'

// Тема мини-аппов (пассажир/водитель). Исторически оба приложения свёрстаны
// тёмными без вариантов, поэтому:
// - дефолт режима — 'dark' (существующие пользователи не видят изменений);
// - 'auto' следует теме Telegram-клиента (colorScheme + событие themeChanged),
//   вне Telegram — prefers-color-scheme;
// - выбранный режим хранится в localStorage и переживает перезапуск.
// Класс 'dark'/'light' вешается на <html> — UnoCSS-варианты dark:/light:
// работают из коробки (class-based режим presetUno).

export type ThemeMode = 'auto' | 'dark' | 'light'
export type ResolvedTheme = 'dark' | 'light'

const THEME_KEY = 'app:theme'

// resolveTheme — чистая функция резолва: явный выбор → Telegram → prefers →
// тёмная. Любое неожиданное значение mode (мусор в localStorage) читается как
// 'auto', а не роняет тему.
export function resolveTheme(
  mode: string,
  telegramScheme: null | ResolvedTheme,
  prefersDark: boolean | null,
): ResolvedTheme {
  if (mode === 'dark' || mode === 'light')
    return mode
  if (telegramScheme)
    return telegramScheme
  if (prefersDark !== null)
    return prefersDark ? 'dark' : 'light'
  return 'dark'
}

// Сигналы окружения — модульные ref'ы (синглтон на приложение, как в
// useLocationAccess): слушатели обновляют их, resolved пересчитывается сам.
const telegramScheme = ref<null | ResolvedTheme>(null)
const prefersDark = ref<boolean | null>(null)

const mode = useLocalStorage<ThemeMode>(THEME_KEY, 'dark')

const resolvedTheme = computed<ResolvedTheme>(() =>
  resolveTheme(mode.value, telegramScheme.value, prefersDark.value),
)

function readTelegramScheme(): null | ResolvedTheme {
  try {
    const scheme = (window as { Telegram?: { WebApp?: { colorScheme?: string } } })
      .Telegram
      ?.WebApp
      ?.colorScheme
    return scheme === 'dark' || scheme === 'light' ? scheme : null
  }
  catch {
    return null
  }
}

let started = false

// startAppTheme запускается один раз на приложение (модуль appearance в main).
// Вешает класс на <html> и подписывается на смену темы Telegram/ОС — режим
// 'auto' реагирует живьём, без перезапуска мини-аппа.
export function startAppTheme(): void {
  if (started || typeof window === 'undefined')
    return
  started = true

  telegramScheme.value = readTelegramScheme()

  try {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    prefersDark.value = media.matches
    media.addEventListener('change', (event) => {
      prefersDark.value = event.matches
    })
  }
  catch {}

  // Событие Telegram о смене темы клиента. onEvent есть не во всех версиях —
  // защитно, без падения вне Telegram.
  try {
    const webApp = (window as {
      Telegram?: { WebApp?: { onEvent?: (event: string, cb: () => void) => void } }
    }).Telegram?.WebApp
    webApp?.onEvent?.('themeChanged', () => {
      telegramScheme.value = readTelegramScheme()
    })
  }
  catch {}

  watchEffect(() => {
    const theme = resolvedTheme.value
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    // Нативные контролы (скроллбары, инпуты) следуют теме приложения.
    root.style.colorScheme = theme
  })
}

export function useAppTheme() {
  return { mode, resolvedTheme }
}
