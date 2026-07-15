import type { TripOptions } from '~/types/trips'

export interface TripOptionBadge {
  icon: string
  label: string
}

// Бейджи опций заказа для оффера и карточки активного заказа: водитель видит
// «кресло/животное/особые потребности/заказ другу» до и после принятия.
export function tripOptionBadges(options?: null | TripOptions): TripOptionBadge[] {
  if (!options)
    return []

  const badges: TripOptionBadge[] = []

  if (options.child_seat)
    badges.push({ icon: 'i-mdi-car-child-seat', label: 'Детское кресло' })

  if (options.pets)
    badges.push({ icon: 'i-mdi-paw', label: 'С животным' })

  if (options.accessible)
    badges.push({ icon: 'i-mdi-human-wheelchair', label: 'Особые потребности' })

  if (options.friend_name || options.friend_phone) {
    const contact = [options.friend_name, options.friend_phone].filter(Boolean).join(' · ')
    badges.push({ icon: 'i-mdi-account-arrow-right', label: `Едет: ${contact}` })
  }

  return badges
}
