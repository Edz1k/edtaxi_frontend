import type { ParkChangeRequestPayload, TaxiPark } from '~/types/park'

/**
 * Комиссия парка в процентах для UI: бэкенд хранит долю (0.015 → 1.5%).
 * Округление до 0.1% — так же значение показывается в кабинете.
 */
export function parkCommissionPct(park: Pick<TaxiPark, 'commission_rate'> | null): number {
  return park ? +(park.commission_rate * 100).toFixed(1) : 0
}

/**
 * Собирает заявку на изменение БИН/комиссии: в payload попадают только
 * реально изменённые поля — бэкенд трактует отсутствие поля как «не менять».
 * Пустой объект означает «ничего не изменилось» (заявку слать не нужно).
 */
export function buildParkChangePayload(
  park: Pick<TaxiPark, 'bin' | 'commission_rate'>,
  form: { bin: string, commission_rate_pct: number },
): ParkChangeRequestPayload {
  const payload: ParkChangeRequestPayload = {}

  const bin = form.bin.trim()
  const currentBin = (park.bin ?? '').trim()
  if (bin && bin !== currentBin)
    payload.bin = bin

  if (form.commission_rate_pct !== parkCommissionPct(park))
    payload.commission_rate = +(form.commission_rate_pct / 100).toFixed(4)

  return payload
}
