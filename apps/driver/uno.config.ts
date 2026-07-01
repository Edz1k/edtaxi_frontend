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
    'i-mdi-alert',
    'i-mdi-car-hatchback',
    'i-mdi-car-info',
    'i-mdi-cash-multiple',
    'i-mdi-cellphone-check',
    'i-mdi-check',
    'i-mdi-check-circle',
    'i-mdi-clock-outline',
    'i-mdi-close-circle',
    'i-mdi-cog-outline',
    'i-mdi-flag-checkered',
    'i-mdi-headset',
    'i-mdi-information',
    'i-mdi-link-off',
    'i-mdi-loading',
    'i-mdi-map-marker-check',
    'i-mdi-navigation-variant',
    'i-mdi-office-building-marker',
    'i-mdi-play-circle',
    'i-mdi-radar',
    'i-mdi-shield-key',
    'i-mdi-steering',
    'i-mdi-telegram',
    'i-mdi-view-grid-outline',
    'i-mdi-whatsapp',
    'i-mdi-message-text-outline',
  ],
})
