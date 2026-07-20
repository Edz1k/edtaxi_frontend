import type { GeoPlace } from '@edtaxi/shared/types/geocoding'

// Черновик маршрута переживает перезапуск мини-аппа: пассажир свернул Telegram,
// вернулся — адреса на месте, вводить заново не надо.
//
// Плагина персиста в проекте нет и тащить его ради одного стора незачем —
// делаем как в водительском аппе (NAV_PROGRESS_KEY в stores/driver.ts): один
// ключ, JSON, всё в try/catch. localStorage может быть недоступен (приватный
// режим, заблокированные хранилища) — тогда фича просто не работает, а
// приложение живёт дальше.
const ROUTE_DRAFT_KEY = 'passenger:route-draft'

// Сколько живёт черновик. Час покрывает «свернул и вернулся», но не переживает
// ночь: без срока вчерашний маршрут всплыл бы как сегодняшний, и пассажир
// заказал бы машину не туда, даже не заметив подмены.
export const ROUTE_DRAFT_TTL_MS = 60 * 60 * 1000

export interface RouteDraft {
  destination: string
  destinationPlace: GeoPlace | null
  pickup: string
  pickupPlace: GeoPlace | null
  // Остановки без адреса (пустые строки формы) не сохраняем — восстанавливать
  // там нечего.
  stops: GeoPlace[]
}

interface StoredDraft extends RouteDraft {
  savedAt: number
}

export function saveRouteDraft(draft: RouteDraft, now: number): void {
  try {
    // Пустой черновик хранить незачем — и он же не должен перетирать хранилище
    // мусором при каждом холостом изменении.
    if (!draft.pickup && !draft.destination && draft.stops.length === 0) {
      clearRouteDraft()
      return
    }
    const payload: StoredDraft = { ...draft, savedAt: now }
    localStorage.setItem(ROUTE_DRAFT_KEY, JSON.stringify(payload))
  }
  catch {}
}

// readRouteDraft возвращает null, если черновика нет, он просрочен или формат
// не тот (старая версия приложения, ручная правка хранилища).
export function readRouteDraft(now: number): RouteDraft | null {
  try {
    const raw = localStorage.getItem(ROUTE_DRAFT_KEY)
    if (!raw)
      return null

    const parsed = JSON.parse(raw) as Partial<StoredDraft>
    if (typeof parsed.savedAt !== 'number' || now - parsed.savedAt > ROUTE_DRAFT_TTL_MS)
      return null

    return {
      destination: typeof parsed.destination === 'string' ? parsed.destination : '',
      destinationPlace: isPlace(parsed.destinationPlace) ? parsed.destinationPlace : null,
      pickup: typeof parsed.pickup === 'string' ? parsed.pickup : '',
      pickupPlace: isPlace(parsed.pickupPlace) ? parsed.pickupPlace : null,
      stops: Array.isArray(parsed.stops) ? parsed.stops.filter(isPlace) : [],
    }
  }
  catch {
    return null
  }
}

export function clearRouteDraft(): void {
  try {
    localStorage.removeItem(ROUTE_DRAFT_KEY)
  }
  catch {}
}

// Координаты проверяем по-настоящему: с битым place заказ ушёл бы с мусорной
// точкой подачи, а это хуже, чем потерянный черновик.
function isPlace(value: unknown): value is GeoPlace {
  if (!value || typeof value !== 'object')
    return false

  const place = value as Partial<GeoPlace>
  return typeof place.address === 'string'
    && typeof place.lat === 'number' && Number.isFinite(place.lat)
    && typeof place.lng === 'number' && Number.isFinite(place.lng)
}
