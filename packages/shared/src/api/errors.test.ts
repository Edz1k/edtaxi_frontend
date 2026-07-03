import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './client'
import { getUserErrorMessage, showErrorToast } from './errors'

// showErrorToast pulls in the real toast composable, which relies on an
// auto-imported `ref`. Stub it so we can assert what gets shown.
const { errorToast } = vi.hoisted(() => ({ errorToast: vi.fn() }))
vi.mock('../composables/useToast', () => ({
  useToast: () => ({ error: errorToast }),
}))

beforeEach(() => {
  errorToast.mockReset()
})

describe('getUserErrorMessage', () => {
  it('maps a known server message to its localized text', () => {
    expect(getUserErrorMessage(new ApiError(404, 'trip not found', null), 'fallback'))
      .toBe('Поездка не найдена.')
  })

  it('matches known messages case-insensitively and trims whitespace', () => {
    expect(getUserErrorMessage(new ApiError(404, '  Trip Not Found  ', null), 'fallback'))
      .toBe('Поездка не найдена.')
  })

  it('falls back to a status-based message for unknown server messages', () => {
    expect(getUserErrorMessage(new ApiError(403, 'some unmapped reason', null), 'fallback'))
      .toBe('Недостаточно прав для этого действия.')
  })

  it('uses the provided fallback when both message and status are unknown', () => {
    expect(getUserErrorMessage(new ApiError(418, 'teapot', null), 'custom fallback'))
      .toBe('custom fallback')
  })

  it('returns the message of a plain Error', () => {
    expect(getUserErrorMessage(new Error('boom'), 'fallback')).toBe('boom')
  })

  it('returns the fallback for non-error values', () => {
    expect(getUserErrorMessage(null, 'fallback')).toBe('fallback')
    expect(getUserErrorMessage('nope', 'fallback')).toBe('fallback')
  })
})

describe('showErrorToast', () => {
  it('shows the resolved message and returns it', () => {
    const message = showErrorToast(new ApiError(404, 'trip not found', null), 'fallback')

    expect(message).toBe('Поездка не найдена.')
    expect(errorToast).toHaveBeenCalledWith('Что-то пошло не так', 'Поездка не найдена.')
  })

  it('honours a custom title', () => {
    showErrorToast(new Error('boom'), 'fallback', 'Ошибка сети')

    expect(errorToast).toHaveBeenCalledWith('Ошибка сети', 'boom')
  })
})
