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
  main: {
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
  secondary: {
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

  // ===== Семантические токены темы мини-аппов =====
  // Пара «тёмное+светлое» в одном классе: экраны верстаются токенами, и обе
  // темы остаются согласованными по построению. Тёмная часть — исторические
  // значения (пиксель-в-пиксель с прежней версткой), светлая подобрана к ним.
  // Класс dark/light на <html> ставит startAppTheme (composables/appearance).
  ['app-screen', 'bg-secondary-900 text-white light:bg-secondary-50 light:text-secondary-800'],
  // Плавающие панели с blur (шапка, таб-бар, шторки).
  ['app-surface', 'border-white/10 bg-secondary-950/78 light:border-black/8 light:bg-white/85'],
  // Карточка на экране и вложенная плашка/иконка-чип внутри карточки.
  ['app-card', 'bg-white/5 light:bg-white light:shadow-[0_2px_10px_rgba(16,20,26,0.05)]'],
  ['app-chip', 'bg-white/8 light:bg-secondary-100/70'],
  // Неактивный элемент выбора (сегменты, пилюли фильтров).
  ['app-chip-idle', 'bg-white/8 text-slate-400 light:bg-secondary-100/70 light:text-slate-500'],
  // Текстовые роли: приглушённый, едва заметный, акцент бренда, контраст.
  ['app-muted', 'text-slate-400 light:text-slate-500'],
  ['app-faint', 'text-slate-500 light:text-slate-400'],
  ['app-accent', 'text-main-300 light:text-main-600'],
  ['app-strong', 'text-white light:text-secondary-800'],
  ['app-border', 'border-white/10 light:border-black/10'],
  // Поле ввода на тёмной/светлой карточке.
  ['app-input', 'border-white/10 bg-secondary-950/70 text-white light:border-black/12 light:bg-white light:text-secondary-800'],
  // Фон поля ввода (когда border/text заданы отдельно в разметке).
  ['app-input-surface', 'bg-secondary-950/70 light:bg-white light:text-secondary-800'],
  // Плотная плавающая панель (шторки, модалки, оффер) с blur-подложкой.
  ['app-sheet', 'bg-secondary-950/82 light:bg-white/92 light:text-secondary-800'],
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
