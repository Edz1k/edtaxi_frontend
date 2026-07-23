import { config } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ru from '../locales/ru.yml'

// Компоненты водителя зовут useI18n() — в тестах монтируем их с реальными
// русскими сообщениями, чтобы ассерты на текст оставались осмысленными.
const i18n = createI18n<false>({
  legacy: false,
  locale: 'ru',
  fallbackLocale: 'ru',
  messages: { ru } as never,
})

config.global.plugins = [...(config.global.plugins ?? []), i18n]
