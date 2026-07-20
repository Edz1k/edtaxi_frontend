import { ApiError } from '~/api/client'

// Текст, который видит водитель после попытки отправить заявку в каталог
// (TODO п.10). Разные 409 различаются по сообщению бэка; 404/сеть/старый бэк
// (роут ещё не задеплоен) деградируют до нейтрального «обратитесь в поддержку».
export function carRequestSubmitError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      // «this model is already in the catalog» vs «a pending request … already exists»
      if (/catalog/i.test(error.message))
        return 'Эта модель уже есть в каталоге — проверьте написание марки и модели.'
      return 'Заявка на эту модель уже на рассмотрении.'
    }
    if (error.status === 400)
      return 'Проверьте марку, модель и год выпуска.'
  }
  // 404 (старый бэк без роута), сеть, 5xx — общий фолбэк.
  return 'Не удалось отправить заявку. Обратитесь в поддержку, если это ошибка.'
}
