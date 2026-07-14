// Теги отзыва о пассажире. Слаги — контракт бэка (entity.PassengerRatingTags):
// неизвестный слаг сервер отклонит, подписи локализуются здесь.
export interface RatingTag {
  label: string
  positive: boolean
  value: string
}

export const PASSENGER_RATING_TAGS: RatingTag[] = [
  { label: 'Вежливый', positive: true, value: 'polite' },
  { label: 'Пунктуальный', positive: true, value: 'punctual' },
  { label: 'Опоздал', positive: false, value: 'late' },
  { label: 'Грубость', positive: false, value: 'rude' },
  { label: 'Мусор в салоне', positive: false, value: 'littered' },
]

// Оценка 4-5 — предлагаем «хорошие» чипы, 1-3 — «плохие».
export function tagsForScore(score: number): RatingTag[] {
  return PASSENGER_RATING_TAGS.filter(tag => tag.positive === (score >= 4))
}
