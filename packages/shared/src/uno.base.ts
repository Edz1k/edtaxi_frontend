import mdiIcons from '@iconify-json/mdi/icons.json'
import { createLocalFontProcessor } from '@unocss/preset-web-fonts/local'
import {
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export const unoColors = {
  // Семантические токены темы (packages/shared/src/styles/theme.css). Значение —
  // RGB-каналы в CSS-переменной, поэтому alpha-модификаторы (bg-surface/8,
  // text-muted/70) работают через <alpha-value>.
  'bg': 'rgb(var(--c-bg) / <alpha-value>)',
  'body': 'rgb(var(--c-body) / <alpha-value>)',
  'border': 'rgb(var(--c-border) / <alpha-value>)',
  'muted': 'rgb(var(--c-muted) / <alpha-value>)',
  'surface': 'rgb(var(--c-surface) / <alpha-value>)',
  'surface-strong': 'rgb(var(--c-surface-strong) / <alpha-value>)',
  'main': {
    50: '#fff8db',
    100: '#ffefad',
    200: '#ffe071',
    300: '#ffd152',
    400: '#f6c44a',
    500: '#e6ad2e',
    600: '#c58a1f',
    700: '#9d681b',
    800: '#704817',
    900: '#3f2d13',
    950: '#211606',
  },
  'secondary': {
    50: '#f4f5f7',
    100: '#dfe2e7',
    200: '#b8bec8',
    300: '#8b95a3',
    400: '#606b78',
    500: '#3e4651',
    600: '#2b3139',
    700: '#1b2027',
    800: '#10141a',
    900: '#07090d',
    950: '#050608',
  },
}

export const unoShortcuts: Array<[string, string]> = [
  ['btn', 'px-4 py-1 rounded inline-block bg-main-500 text-white cursor-pointer !outline-none hover:bg-main-600 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
  ['icon-btn', 'inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-main-400'],
]

export const unoPresets = [
  presetUno(),
  presetAttributify(),
  presetIcons({
    collections: {
      mdi: () => mdiIcons as any,
    },
    scale: 1.2,
  }),
  presetTypography(),
  presetWebFonts({
    fonts: {
      sans: 'DM Sans',
      serif: 'DM Serif Display',
      mono: 'DM Mono',
    },
    processors: createLocalFontProcessor(),
  }),
]

export const unoTransformers = [
  transformerDirectives(),
  transformerVariantGroup(),
]
