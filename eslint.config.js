// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    // Vue/TS включены явно: antfu авто-детектит фреймворк по зависимостям
    // ближайшего package.json, а в корневом монорепо-package.json нет `vue`,
    // поэтому без этого все .vue в apps/* молча игнорировались линтом.
    typescript: true,
    vue: true,
    unocss: true,
    formatters: true,
    pnpm: true,
    ignores: ['.claude/**'],
  },
  {
    // packages/shared — библиотека без собственного uno.config (uno-контекст
    // приходит от приложения-потребителя), поэтому unocss-плагин на её .vue
    // бросает «No config file found». Выключаем сортировку классов только тут.
    files: ['packages/shared/**/*.vue'],
    rules: {
      'unocss/order': 'off',
      'unocss/order-attributify': 'off',
    },
  },
  {
    files: ['README.md'],
    rules: {
      'markdown/heading-increment': 'off',
    },
  },
  {
    files: ['pnpm-workspace.yaml'],
    rules: {
      'pnpm/yaml-enforce-settings': 'off',
    },
  },
)
