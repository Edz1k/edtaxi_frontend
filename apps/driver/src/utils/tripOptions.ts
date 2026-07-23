import type { TripOptions } from '~/types/trips'

export interface TripOptionBadge {
  icon: string
  labelKey: string
  params?: Record<string, string>
}

// Бейджи опций заказа для оффера и карточки активного заказа: водитель видит
// «кресло/животное/особые потребности/заказ другу» до и после принятия.
export function tripOptionBadges(options?: null | TripOptions): TripOptionBadge[] {
  if (!options)
    return []

  const badges: TripOptionBadge[] = []

  if (options.child_seat)
    badges.push({ icon: 'i-mdi-car-child-seat', labelKey: 'tripOptions.childSeat' })

  if (options.pets)
    badges.push({ icon: 'i-mdi-paw', labelKey: 'tripOptions.pets' })

  if (options.accessible)
    badges.push({ icon: 'i-mdi-human-wheelchair', labelKey: 'tripOptions.accessible' })

  if (options.friend_name || options.friend_phone) {
    const contact = [options.friend_name, options.friend_phone].filter(Boolean).join(' · ')
    badges.push({ icon: 'i-mdi-account-arrow-right', labelKey: 'tripOptions.rider', params: { contact } })
  }

  return badges
}
