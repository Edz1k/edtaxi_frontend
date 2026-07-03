import { beforeEach, describe, expect, it, vi } from 'vitest'

// client.ts builds two axios instances at import time: `apiClient` (used via
// `.request`) and `refreshClient` (used via `.post`). We hoist a mock for each
// so every test can drive their responses independently.
const { requestMock, refreshMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  refreshMock: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    create: () => ({ request: requestMock, post: refreshMock }),
  },
  isAxiosError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && 'isAxiosError' in error),
}))

// Imported after the mock is registered (vitest hoists vi.mock above imports).
const { apiRequest, ApiError, AUTH_SESSION_CHANGED_EVENT } = await import('../api/client')

interface FakeAxiosError {
  isAxiosError: true
  message: string
  response: { status: number, data: unknown, statusText: string }
}

function axiosError(status: number, data?: unknown, statusText = ''): FakeAxiosError {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status, data, statusText },
  }
}

beforeEach(() => {
  requestMock.mockReset()
  refreshMock.mockReset()
})

describe('apiRequest', () => {
  it('returns the response body on success', async () => {
    requestMock.mockResolvedValue({ data: { id: 1 } })

    await expect(apiRequest('/me')).resolves.toEqual({ id: 1 })
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('rethrows non-axios errors untouched', async () => {
    const boom = new Error('network down')
    requestMock.mockRejectedValue(boom)

    await expect(apiRequest('/me')).rejects.toBe(boom)
  })

  it('wraps axios errors in ApiError with status, message and data', async () => {
    requestMock.mockRejectedValue(axiosError(422, { error: 'invalid phone' }))

    await expect(apiRequest('/otp', { skipAuthRefresh: true })).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      message: 'invalid phone',
      data: { error: 'invalid phone' },
    })
    await expect(apiRequest('/otp', { skipAuthRefresh: true })).rejects.toBeInstanceOf(ApiError)
  })

  it('does not attempt a refresh when the 401 is a missing token', async () => {
    requestMock.mockRejectedValue(axiosError(401, { error: 'missing token' }))

    await expect(apiRequest('/me')).rejects.toBeInstanceOf(ApiError)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('does not attempt a refresh when skipAuthRefresh is set', async () => {
    requestMock.mockRejectedValue(axiosError(401, { error: 'expired' }))

    await expect(apiRequest('/me', { skipAuthRefresh: true })).rejects.toBeInstanceOf(ApiError)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('refreshes once and replays the original request after a 401', async () => {
    requestMock
      .mockRejectedValueOnce(axiosError(401, { error: 'expired' }))
      .mockResolvedValueOnce({ data: { id: 1 } })
    refreshMock.mockResolvedValue({ data: {} })

    await expect(apiRequest('/me')).resolves.toEqual({ id: 1 })
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledTimes(2)
  })

  // The core of the fix in commit e4fe807: several requests expiring at once
  // must share a single refresh call, because the refresh token is single-use.
  it('dedupes concurrent 401 refreshes into a single refresh call', async () => {
    requestMock
      .mockRejectedValueOnce(axiosError(401, { error: 'expired' }))
      .mockRejectedValueOnce(axiosError(401, { error: 'expired' }))
      .mockResolvedValue({ data: { ok: true } })
    refreshMock.mockResolvedValue({ data: {} })

    const [a, b] = await Promise.all([apiRequest('/a'), apiRequest('/b')])

    expect(a).toEqual({ ok: true })
    expect(b).toEqual({ ok: true })
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('signals a session change and throws when the refresh fails', async () => {
    const win = new EventTarget()
    const onSessionChanged = vi.fn()
    win.addEventListener(AUTH_SESSION_CHANGED_EVENT, onSessionChanged)
    vi.stubGlobal('window', win)

    requestMock.mockRejectedValue(axiosError(401, { error: 'expired' }))
    refreshMock.mockRejectedValue(axiosError(401, { error: 'invalid refresh token' }))

    await expect(apiRequest('/me')).rejects.toBeInstanceOf(ApiError)
    expect(onSessionChanged).toHaveBeenCalledTimes(1)
    // The failed request is not replayed.
    expect(requestMock).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })
})
