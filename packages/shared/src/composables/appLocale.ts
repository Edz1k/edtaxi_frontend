import { useLocalStorage } from '@vueuse/core'
import { getTelegramInitData } from './auth/telegram'

// Язык мини-аппов: ru / kk / en. Первый запуск — язык Telegram-профиля
// пользователя (language_code из initData), дальше выбор в настройках
// сохраняется в localStorage и побеждает всегда.

export const APP_LOCALES = ['ru', 'kk', 'en'] as const
export type AppLocale = (typeof APP_LOCALES)[number]

// Название языка пишется на нём самом — это конвенция языковых меню,
// поэтому лейблы не переводятся и живут здесь, а не в словарях.
export const APP_LOCALE_NATIVE_NAMES: Record<AppLocale, string> = {
  en: 'English',
  kk: 'Қазақша',
  ru: 'Русский',
}

const LOCALE_KEY = 'app:locale'

// normalizeAppLocale приводит произвольный языковой код к поддерживаемой
// локали: регистр и регион отбрасываются (en-US → en), 'kz' — частая путаница
// кода страны с языковым 'kk' — принимается как казахский. Неизвестное → null.
export function normalizeAppLocale(value: null | string | undefined): AppLocale | null {
  if (!value)
    return null
  const lang = value.toLowerCase().split('-')[0]
  if (lang === 'kz')
    return 'kk'
  return (APP_LOCALES as readonly string[]).includes(lang) ? lang as AppLocale : null
}

// pickInitialLocale — стартовая локаль: сохранённый выбор → язык
// Telegram-профиля → русский (дефолт рынка).
export function pickInitialLocale(
  saved: null | string | undefined,
  telegramLanguageCode: null | string | undefined,
): AppLocale {
  return normalizeAppLocale(saved)
    ?? normalizeAppLocale(telegramLanguageCode)
    ?? 'ru'
}

// getTelegramLanguageCode читает language_code из подписанного initData
// (user=%7B...%7D — URL-энкоженный JSON). Защитно: вне Telegram или при
// неожиданном формате — null.
export function getTelegramLanguageCode(): null | string {
  try {
    const raw = getTelegramInitData()
    if (!raw)
      return null
    const userJson = new URLSearchParams(raw).get('user')
    if (!userJson)
      return null
    const user = JSON.parse(userJson) as { language_code?: unknown }
    return typeof user.language_code === 'string' ? user.language_code : null
  }
  catch {
    return null
  }
}

// Сохранённый выбор пользователя ('' = ещё не выбирал — берём язык Telegram).
const savedLocale = useLocalStorage(LOCALE_KEY, '')

export function useAppLocale() {
  return {
    // Активная локаль с учётом всех источников — то, что видит i18n.
    current: (): AppLocale => pickInitialLocale(savedLocale.value, getTelegramLanguageCode()),
    savedLocale,
    setLocale(locale: AppLocale) {
      savedLocale.value = locale
    },
  }
}
