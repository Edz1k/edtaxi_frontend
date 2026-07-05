import { useColorMode, usePreferredDark, useToggle } from '@vueuse/core'
import { computed } from 'vue'

export type ThemePreference = 'auto' | 'dark' | 'light'

const STORAGE_KEY = 'vueuse-color-scheme'

// Снимок наличия сохранённого выбора ДО инициализации useColorMode: сам
// useColorMode при старте пишет в localStorage дефолт 'auto', поэтому проверять
// ключ нужно заранее. Используется, чтобы «засеять» тему из Telegram только
// когда пользователь ещё ничего не выбирал (см. telegram/theme.ts).
export const hasStoredThemeChoice = typeof localStorage !== 'undefined'
  && localStorage.getItem(STORAGE_KEY) != null

// Единый источник темы: 'auto' | 'light' | 'dark'. useColorMode сам тоглит
// класс .dark на <html>, держит color-scheme и персистит выбор в localStorage.
// emitAuto сохраняет именно 'auto' для режима «Системная», чтобы тема следовала
// за системой, а не фиксировала снимок.
export const colorMode = useColorMode({
  emitAuto: true,
  storageKey: STORAGE_KEY,
})

export const preferredDark = usePreferredDark()

// Фактическая тёмность: в режиме 'auto' её решает системная тема.
export const isDark = computed<boolean>({
  get: () => colorMode.value === 'auto'
    ? preferredDark.value
    : colorMode.value === 'dark',
  set: value => colorMode.value = value ? 'dark' : 'light',
})

export const toggleDark = useToggle(isDark)

// Режим «Системная»: тема следует за usePreferredDark, ручной выбор сбрасывается.
export const isSystemTheme = computed<boolean>({
  get: () => colorMode.value === 'auto',
  set: value => colorMode.value = value
    ? 'auto'
    : isDark.value ? 'dark' : 'light',
})
