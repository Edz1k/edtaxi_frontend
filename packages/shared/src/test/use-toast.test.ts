import { beforeEach, describe, expect, it } from 'vitest'
import { useToast } from '../composables/useToast'

// Состояние тостов — модульный синглтон, чистим его между тестами.
beforeEach(() => {
  const { removeToast, toasts } = useToast()
  for (const toast of [...toasts.value])
    removeToast(toast.id)
})

describe('useToast', () => {
  it('shows different toasts independently', () => {
    const toast = useToast()

    toast.warning('Геолокация недоступна', 'Разрешите доступ к геолокации.')
    toast.error('Что-то пошло не так', 'Поездка не найдена.')

    expect(toast.toasts.value).toHaveLength(2)
  })

  it('does not stack an identical toast while it is still visible', () => {
    const toast = useToast()

    const first = toast.warning('Геолокация недоступна', 'Разрешите доступ к геолокации.')
    const second = toast.warning('Геолокация недоступна', 'Разрешите доступ к геолокации.')

    expect(second).toBe(first)
    expect(toast.toasts.value).toHaveLength(1)
  })

  it('treats same title with different kind or description as distinct toasts', () => {
    const toast = useToast()

    toast.warning('Геолокация недоступна', 'Разрешите доступ к геолокации.')
    toast.warning('Геолокация недоступна', 'Геопозиция сейчас недоступна.')
    toast.error('Геолокация недоступна', 'Разрешите доступ к геолокации.')

    expect(toast.toasts.value).toHaveLength(3)
  })

  it('shows the toast again after the previous one was dismissed', () => {
    const toast = useToast()

    const first = toast.warning('Геолокация недоступна', 'Разрешите доступ к геолокации.')
    toast.removeToast(first)
    const second = toast.warning('Геолокация недоступна', 'Разрешите доступ к геолокации.')

    expect(second).not.toBe(first)
    expect(toast.toasts.value).toHaveLength(1)
  })
})
