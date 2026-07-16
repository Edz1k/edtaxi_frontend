// Недавние получатели заказа. Telegram не даёт мини-аппу доступа к адресной
// книге — в протоколе просто нет такого разрешения (request_phone отдаёт только
// СВОЙ номер), поэтому «выбрать контакт» заменяем памятью о тех, кому уже
// заказывали: тап по чипсу вместо повторного набора номера.
export interface RecentRider {
  name: string
  phone: string
}

const STORAGE_KEY = 'edtaxi:recent-riders'
const MAX_RECENT = 5

function readRecentRiders(): RecentRider[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed))
      return []

    return parsed
      .filter((item): item is RecentRider =>
        typeof item?.phone === 'string' && typeof item?.name === 'string')
      .slice(0, MAX_RECENT)
  }
  catch {
    return []
  }
}

export function useRecentRiders() {
  const recent = ref<RecentRider[]>(readRecentRiders())

  // remember кладёт получателя наверх списка, схлопывая дубли по номеру.
  function remember(rider: RecentRider) {
    if (!rider.phone)
      return

    recent.value = [rider, ...recent.value.filter(item => item.phone !== rider.phone)].slice(0, MAX_RECENT)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.value))
    }
    catch {}
  }

  return { recent, remember }
}
