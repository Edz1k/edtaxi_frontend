// Теги отзыва о водителе. Слаги — контракт бэка (entity.DriverRatingTags):
// неизвестный слаг сервер отклонит, подписи локализуются здесь.
export interface RatingTag {
  label: string
  positive: boolean
  value: string
}

export const DRIVER_RATING_TAGS: RatingTag[] = [
  { label: 'Вежливый', positive: true, value: 'polite' },
  { label: 'Чистый салон', positive: true, value: 'clean_car' },
  { label: 'Аккуратное вождение', positive: true, value: 'safe_driving' },
  { label: 'Хорошая музыка', positive: true, value: 'good_music' },
  { label: 'Опасное вождение', positive: false, value: 'dangerous_driving' },
  { label: 'Грубость', positive: false, value: 'rude' },
  { label: 'Грязный салон', positive: false, value: 'dirty_car' },
]

// Оценка 4-5 — предлагаем «хорошие» чипы, 1-3 — «плохие».
export function tagsForScore(score: number): RatingTag[] {
  return DRIVER_RATING_TAGS.filter(tag => tag.positive === (score >= 4))
}
