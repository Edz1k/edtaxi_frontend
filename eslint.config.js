// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    unocss: true,
    formatters: true,
    pnpm: true,
    ignores: ['.claude/**'],
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
