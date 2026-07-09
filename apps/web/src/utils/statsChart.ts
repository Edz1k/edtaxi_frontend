// Утилиты дашбордных барчартов (обзор админки, аналитика парка).
// Корзины приходят с бэкенда непрерывными сериями (/admin/overview,
// /park/analytics/daily) — здесь только подписи, шкала и форматирование.

export interface StatBucket {
  key: string
  /** Короткая подпись под осью X (например «9», «июл»). */
  label: string
  /** Полная подпись периода для readout и таблицы (например «9 июля»). */
  fullLabel: string
  value: number
  /** Доп. строка readout под значением (например «12 заказов · 5 водителей»). */
  hint?: string
}

const dayFullFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const monthShortFormat = new Intl.DateTimeFormat('ru-RU', { month: 'short' })
const monthFullFormat = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
const compactNumberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, notation: 'compact' })
const wholeNumberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// Ключи серий разбираем вручную: new Date('YYYY-MM-DD') трактуется как UTC
// и в отрицательных таймзонах уехал бы на день назад.
function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function parseMonthKey(key: string): Date {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

/** Подписи дневной корзины: '2026-07-09' → метка «9», readout «9 июля». */
export function dayBucketLabels(key: string): Pick<StatBucket, 'fullLabel' | 'label'> {
  const date = parseDayKey(key)
  return { fullLabel: dayFullFormat.format(date), label: String(date.getDate()) }
}

/** Подписи месячной корзины: '2026-07' → метка «июл», readout «Июль 2026». */
export function monthBucketLabels(key: string): Pick<StatBucket, 'fullLabel' | 'label'> {
  const date = parseMonthKey(key)
  return {
    fullLabel: capitalize(monthFullFormat.format(date)),
    label: monthShortFormat.format(date).replace('.', ''),
  }
}

/** Округляет максимум оси вверх до «круглого» значения (1 / 1.5 / 2 / 2.5 / … × 10ⁿ). */
export function niceCeil(value: number): number {
  if (value <= 0)
    return 1
  const exp = 10 ** Math.floor(Math.log10(value))
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  for (const step of steps) {
    if (step * exp >= value)
      return step * exp
  }
  return 10 * exp
}

/** Компактная подпись оси: 50 000 → «50 тыс.». */
export function formatCompactNumber(value: number) {
  return compactNumberFormat.format(value)
}

/** Целое с разрядами: 12345 → «12 345». */
export function formatWholeNumber(value: number) {
  return wholeNumberFormat.format(value)
}

/**
 * Русская плюрализация: pluralRu(3, ['заказ', 'заказа', 'заказов']) → «3 заказа».
 */
export function pluralRu(count: number, forms: [one: string, few: string, many: string]) {
  const mod10 = Math.abs(count) % 10
  const mod100 = Math.abs(count) % 100
  if (mod10 === 1 && mod100 !== 11)
    return `${formatWholeNumber(count)} ${forms[0]}`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return `${formatWholeNumber(count)} ${forms[1]}`
  return `${formatWholeNumber(count)} ${forms[2]}`
}
