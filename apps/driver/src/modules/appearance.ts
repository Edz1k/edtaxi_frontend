import type { UserModule } from '~/types'
import { startAppTheme } from '@edtaxi/shared/composables/appearance'

// Тема приложения (тёмная/светлая/как в Telegram): класс на <html> +
// подписки на смену темы клиента. Выбор — в настройках, хранение — localStorage.
export const install: UserModule = () => {
  startAppTheme()
}
