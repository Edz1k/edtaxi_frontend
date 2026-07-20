import type { DriverVerificationsResponse } from '~/types/driver'

// Состояние ежедневного фотоконтроля глазами водителя.
// - valid — проверка действует, можно на линию;
// - pending — отправлена, ждёт решения поддержки;
// - rejected — поддержка отклонила (причина в latest_daily_check);
// - expired — заявку не успели рассмотреть, она сгорела;
// - missing — проверок не было или срок последней истёк.
export type DailyCheckState = 'expired' | 'missing' | 'pending' | 'rejected' | 'valid'

// dailyCheckState считает состояние на момент now, а не доверяет одному лишь
// daily_check_valid: срок истекает по часам, и без сверки с now приложение
// показывало бы «Пройдено» до следующего запроса к серверу.
//
// now передаётся параметром (а не берётся внутри), чтобы состояние
// пересчитывалось от реактивного тикера и было проверяемо в тестах.
export function dailyCheckState(
  verification: DriverVerificationsResponse | null,
  now: number,
): DailyCheckState {
  if (!verification)
    return 'missing'

  const latest = verification.latest_daily_check

  // Отправленную заявку показываем как «на проверке» независимо от срока
  // предыдущей: водитель уже сделал свою часть.
  if (latest?.status === 'pending')
    return 'pending'

  if (isDailyCheckValid(verification, now))
    return 'valid'

  if (latest?.status === 'expired')
    return 'expired'

  if (latest?.status === 'rejected')
    return 'rejected'

  return 'missing'
}

// isDailyCheckValid — действует ли проверка прямо сейчас. Старый бэкенд не
// присылает daily_check_valid_until: тогда опираемся на серверный флаг, иначе
// водитель не смог бы выйти на линию до деплоя бэка.
export function isDailyCheckValid(
  verification: DriverVerificationsResponse | null,
  now: number,
): boolean {
  if (!verification?.daily_check_valid)
    return false

  const until = parseValidUntil(verification.daily_check_valid_until)
  if (until === null)
    return true

  return until > now
}

// validUntilLabel — «19:40» для подписи «Действует до …». Пустая строка, если
// момента нет или он не парсится (старый бэкенд, битое значение).
export function validUntilLabel(validUntil: null | string | undefined): string {
  const until = parseValidUntil(validUntil)
  if (until === null)
    return ''

  return new Date(until).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function parseValidUntil(validUntil: null | string | undefined): null | number {
  if (!validUntil)
    return null

  const parsed = new Date(validUntil).getTime()
  return Number.isNaN(parsed) ? null : parsed
}
