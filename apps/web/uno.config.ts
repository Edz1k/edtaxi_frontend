import { unoColors, unoPresets, unoShortcuts, unoTransformers } from '@edtaxi/shared/uno.base'
import { defineConfig } from 'unocss'

export default defineConfig({
  shortcuts: [
    ...unoShortcuts,
  ],
  theme: {
    colors: unoColors,
  },
  presets: unoPresets,
  transformers: unoTransformers,
  safelist: [
    ...'prose prose-sm m-auto text-left'.split(' '),
    'i-mdi-account-group',
    'i-mdi-alert',
    'i-mdi-car-hatchback',
    'i-mdi-check',
    'i-mdi-check-circle',
    'i-mdi-close-circle',
    'i-mdi-cog-outline',
    'i-mdi-headset',
    'i-mdi-information',
    'i-mdi-loading',
    'i-mdi-office-building-marker',
    'i-mdi-shield-key',
    'i-mdi-taxi',
    'i-mdi-whatsapp',
    'i-mdi-message-text-outline',
  ],
})
