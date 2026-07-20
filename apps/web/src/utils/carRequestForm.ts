import type { ApproveCarRequestPayload } from '~/types/carRequest'

// Валидация записи каталога перед одобрением заявки (TODO п.10) — зеркало
// серверного ValidateEntry (max_class ИЛИ минивэн) + диапазон годов.
export function validateCatalogEntryForm(entry: ApproveCarRequestPayload): string | null {
  if (!entry.make.trim() || !entry.model.trim())
    return 'Укажите марку и модель.'
  if (!entry.max_class && !entry.is_minivan)
    return 'Выберите класс или отметьте «Минивэн».'
  if (!Number.isInteger(entry.year_from) || entry.year_from < 1990)
    return 'Год начала выпуска указан неверно.'
  if (entry.year_to != null && entry.year_to < entry.year_from)
    return 'Год окончания не может быть раньше года начала.'
  return null
}
