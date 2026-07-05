import axios, { isAxiosError } from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1'
const API_V1_SUFFIX_RE = /\/api\/v1\/?$/
const HTTP_URL_RE = /^https?:\/\//i
const HTTP_PREFIX_RE = /^http/i
const MEDIA_BASE = API_URL.replace(API_V1_SUFFIX_RE, '')

// Dispatched when the refresh token is invalid/expired so auth stores
// can clear their in-memory session without needing to import this module.
export const AUTH_SESSION_CHANGED_EVENT = 'edtaxi:auth-session-changed'

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

const refreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, message: string, data: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  deviceFingerprint?: string
  params?: Record<string, boolean | number | string | undefined>
  skipAuth?: boolean
  skipAuthRefresh?: boolean
}

function getRuntimeOrigin() {
  return typeof window === 'undefined'
    ? 'http://localhost'
    : window.location.origin
}

function toWsBaseUrl() {
  const configuredWsUrl = import.meta.env.VITE_WS_URL as string | undefined

  if (configuredWsUrl)
    return configuredWsUrl

  const httpBase = HTTP_URL_RE.test(API_URL)
    ? API_URL
    : new URL(API_URL, getRuntimeOrigin()).toString()

  return httpBase
    .replace(HTTP_PREFIX_RE, 'ws')
    .replace(API_V1_SUFFIX_RE, '')
}

export function buildWsUrl(path: string, params: Record<string, string> = {}) {
  const url = new URL(path, toWsBaseUrl())

  Object.entries(params).forEach(([key, value]) => {
    if (value)
      url.searchParams.set(key, value)
  })

  return url.toString()
}

// Turns a relative upload path (/uploads/…) from the API into an absolute URL.
// Pass-through for empty values and already-absolute URLs.
export function mediaUrl(path?: null | string) {
  if (!path)
    return ''
  if (HTTP_URL_RE.test(path))
    return path
  return `${MEDIA_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

function buildHeaders(options: ApiRequestOptions) {
  const headers = new Headers(options.headers)

  if (options.body !== undefined && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json')

  if (options.deviceFingerprint)
    headers.set('X-Device-FP', options.deviceFingerprint)

  const requestHeaders: Record<string, string> = {}
  headers.forEach((value, key) => {
    requestHeaders[key] = value
  })

  return requestHeaders
}

// Concurrent 401s (several requests expiring at once) must not hit
// /auth/token/refresh in parallel: the refresh token is single-use and
// rotated server-side, so a second parallel call would receive an
// already-invalidated token and force a logout even though the first call
// just refreshed the session successfully. Dedupe into one in-flight call.
let refreshPromise: Promise<boolean> | null = null

async function performRefresh(deviceFingerprint?: string) {
  try {
    await refreshClient.post(
      '/auth/token/refresh',
      {},
      {
        headers: deviceFingerprint
          ? { 'X-Device-FP': deviceFingerprint }
          : undefined,
      },
    )

    return true
  }
  catch (error) {
    // Сессию сбрасываем только когда сервер ЯВНО отверг refresh-токен
    // (401/403). Сетевые сбои, 429 от rate limit и 5xx — транзиентные:
    // разлогинивать по ним нельзя, иначе любой чих сети выкидывает живого
    // пользователя на логин.
    const status = isAxiosError(error) ? error.response?.status : undefined

    if ((status === 401 || status === 403) && typeof window !== 'undefined')
      window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT))

    return false
  }
}

function refreshAuthToken(deviceFingerprint?: string) {
  if (!refreshPromise) {
    refreshPromise = performRefresh(deviceFingerprint).finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

async function request<T>(path: string, options: ApiRequestOptions) {
  const requestHeaders = buildHeaders(options)

  const response = await apiClient.request({
    url: path,
    method: options.method,
    signal: options.signal ?? undefined,
    headers: requestHeaders,
    data: options.body,
    params: options.params,
  })

  return response.data as unknown as T
}

function getResponseErrorMessage(data: unknown) {
  return typeof data === 'object' && data && 'error' in data
    ? String(data.error)
    : ''
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  try {
    return await request<T>(path, options)
  }
  catch (error) {
    if (!isAxiosError(error))
      throw error

    const responseMessage = getResponseErrorMessage(error.response?.data)

    // Пробуем refresh и на "missing token": access-cookie могла истечь или
    // потеряться, пока refresh-cookie ещё жива (старые сессии, выданные до
    // выравнивания MaxAge access-cookie с refresh). Для настоящих гостей
    // refresh вернёт 401 один раз (dedupe) и корректно оставит гостя.
    const shouldRefresh = error.response?.status === 401
      && !options.skipAuthRefresh

    if (shouldRefresh) {
      const refreshed = await refreshAuthToken(options.deviceFingerprint)

      if (refreshed)
        return request<T>(path, options)
    }

    const status = error.response?.status ?? 0
    const data = error.response?.data
    const message = responseMessage || error.response?.statusText || error.message

    throw new ApiError(status, message, data)
  }
}
