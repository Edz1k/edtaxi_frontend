import { defineConfig } from 'unocss'
import { unoColors, unoPresets, unoShortcuts, unoTransformers } from '@edtaxi/shared/uno.base'

export default defineConfig({
  shortcuts: [...unoShortcuts],
  theme: { colors: unoColors },
  presets: unoPresets,
  transformers: unoTransformers,
  safelist: [
    'i-mdi-loading',
    'i-mdi-map-marker-outline',
    'i-mdi-taxi',
    'i-mdi-check-circle',
    'i-mdi-clock-outline',
  ],
})
