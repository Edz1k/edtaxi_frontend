import { isTMA, themeParams } from '@telegram-apps/sdk'
import { colorMode, hasStoredThemeChoice } from '../dark'
import { initTelegramSdk } from './sdk'

// Читает тёмность из темы Telegram (themeParams.isDark вычисляется по яркости
// bg_color). Возвращает null вне Telegram или если тему прочитать не удалось.
function readTelegramDark(): boolean | null {
  if (typeof window === 'undefined' || !isTMA())
    return null

  try {
    initTelegramSdk()

    // themeParams доступны синхронно из launch params — восстанавливаем scope
    // (если mountSync недоступен в этой версии Telegram — уйдём в catch).
    if (!themeParams.isMounted())
      themeParams.mountSync()

    const dark = themeParams.isDark()
    return typeof dark === 'boolean' ? dark : null
  }
  catch {
    return null
  }
}

// Засевает начальную тему из Telegram, ТОЛЬКО если пользователь ещё не выбирал
// её сам (нет сохранённого выбора). Ручной выбор всегда побеждает и персистит,
// поэтому повторный запуск после выбора сюда не заходит. Если Telegram-темы нет
// — остаёмся в 'auto' (следуем за системой).
export function seedThemeFromTelegram() {
  if (hasStoredThemeChoice)
    return

  const dark = readTelegramDark()
  if (dark != null)
    colorMode.value = dark ? 'dark' : 'light'
}
