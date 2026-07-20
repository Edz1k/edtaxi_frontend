import type { VehicleCategory } from '~/types/trips'

export const TARIFF_META: Record<VehicleCategory, {
  caption: string
  icon: string
  label: string
}> = {
  business: {
    caption: 'Премиум авто',
    icon: 'i-mdi-diamond-stone',
    label: 'Бизнес',
  },
  business_plus: {
    caption: 'Хантакси · S-класс',
    icon: 'i-mdi-crown',
    label: 'Бизнес+',
  },
  comfort: {
    caption: 'Больше комфорта',
    icon: 'i-mdi-car-seat',
    label: 'Комфорт',
  },
  comfort_plus: {
    caption: 'Хантакси · выше класс',
    icon: 'i-mdi-car-sports',
    label: 'Комфорт+',
  },
  economy: {
    caption: 'Быстро и выгодно',
    icon: 'i-mdi-car-hatchback',
    label: 'Эконом',
  },
  minivan: {
    caption: 'Для компании',
    icon: 'i-mdi-van-passenger',
    label: 'Минивэн',
  },
  moped: {
    caption: 'Дешевле мото · 1 пассажир',
    icon: 'i-mdi-moped',
    label: 'Мопед',
  },
  moto: {
    caption: 'Быстро по городу · 1 пассажир',
    icon: 'i-mdi-motorbike',
    label: 'Мото',
  },
}

// tariffLabel — безопасный доступ к названию тарифа.
//
// Прямое обращение TARIFF_META[category].label роняло всю страницу белым
// экраном, когда бэк присылал категорию, которой в справочнике ещё нет: тип
// VehicleCategory это не ловит, ответ API в него просто приводится. Такое уже
// случилось после п.30 (появились Хантакси и мопед), и повторится с любой
// следующей категорией — поэтому фолбэк, а не только дополненный справочник.
export function tariffLabel(category: string): string {
  return TARIFF_META[category as VehicleCategory]?.label ?? 'Тариф'
}
