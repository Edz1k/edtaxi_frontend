import type { UserModule } from '~/types'
import { useAppLocale } from '@edtaxi/shared/composables/appLocale'
import { watch } from 'vue'
import { createI18n } from 'vue-i18n'

// i18n мини-аппа. Словари ru/kk/en маленькие, поэтому грузим их eager — без
// асинхронной дозагрузки на первом кадре (в web-апе словарей 20 и там lazy).
// Стартовая локаль: сохранённый выбор → язык Telegram-профиля → русский
// (pickInitialLocale в useAppLocale). fallbackLocale: ru — непереведённые
// экраны продолжают показывать русский, миграция строк идёт инкрементально.
const LOCALE_FILE_RE = /([\w-]+)\.yml$/

const messages = Object.fromEntries(
  Object.entries(
    import.meta.glob<{ default: Record<string, unknown> }>('../../locales/*.yml', { eager: true }),
  ).map(([path, mod]) => [path.match(LOCALE_FILE_RE)![1], mod.default]),
)

export const install: UserModule = ({ app }) => {
  const { current, savedLocale } = useAppLocale()

  const i18n = createI18n({
    legacy: false,
    locale: current(),
    fallbackLocale: 'ru',
    messages: messages as never,
  })
  app.use(i18n)
  document.documentElement.setAttribute('lang', current())

  // Смена языка в настройках применяется живьём, без перезапуска мини-аппа.
  watch(savedLocale, () => {
    const next = current()
    i18n.global.locale.value = next
    document.documentElement.setAttribute('lang', next)
  })
}
