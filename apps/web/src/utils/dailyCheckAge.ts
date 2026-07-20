// Заявка на фотоконтроль живёт ограниченное время: если поддержка не успевает
// её посмотреть, заявка сгорает и водителю приходится переснимать. Поэтому в
// очереди важно видеть не только время отправки, но и сколько осталось.
//
// Значение по умолчанию совпадает с DAILY_CHECK_PENDING_TTL_HOURS на бэкенде.
// Оно не приходит с сервером: очередь — вспомогательный индикатор, а решение о
// сгорании всё равно принимает бэкенд (approve просроченной вернёт 409).
export const DAILY_CHECK_PENDING_TTL_MS = 3 * 60 * 60 * 1000

// Порог, с которого заявку стоит подсветить: меньше часа до сгорания.
const URGENT_THRESHOLD_MS = 60 * 60 * 1000

export type DailyCheckUrgency = 'expired' | 'normal' | 'urgent'

// ageLabel — «только что» / «12 мин назад» / «2 ч 5 мин назад».
export function ageLabel(createdAt: string, now: number): string {
  const ageMs = ageMsOf(createdAt, now)
  if (ageMs === null)
    return ''

  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 1)
    return 'только что'
  if (minutes < 60)
    return `${minutes} мин назад`

  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes === 0
    ? `${hours} ч назад`
    : `${hours} ч ${restMinutes} мин назад`
}

// urgency — насколько срочно смотреть заявку.
export function urgency(
  createdAt: string,
  now: number,
  ttlMs = DAILY_CHECK_PENDING_TTL_MS,
): DailyCheckUrgency {
  const ageMs = ageMsOf(createdAt, now)
  if (ageMs === null)
    return 'normal'

  if (ageMs >= ttlMs)
    return 'expired'
  if (ttlMs - ageMs <= URGENT_THRESHOLD_MS)
    return 'urgent'
  return 'normal'
}

// expiresInLabel — «сгорит через 25 мин» для подсветки. Пусто, когда до
// сгорания далеко: лишний счётчик в спокойной очереди только шумит.
export function expiresInLabel(
  createdAt: string,
  now: number,
  ttlMs = DAILY_CHECK_PENDING_TTL_MS,
): string {
  const state = urgency(createdAt, now, ttlMs)
  if (state === 'normal')
    return ''
  if (state === 'expired')
    return 'срок истёк'

  const leftMinutes = Math.max(1, Math.ceil((ttlMs - (ageMsOf(createdAt, now) ?? 0)) / 60_000))
  return `сгорит через ${leftMinutes} мин`
}

// Отрицательный возраст (часы на клиенте отстают от серверных) считаем нулевым:
// «через минуту назад» — бессмыслица, а расхождение в пару минут нормально.
function ageMsOf(createdAt: string, now: number): null | number {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created))
    return null
  return Math.max(0, now - created)
}
