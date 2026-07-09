import { retrieveLaunchParams } from '@telegram-apps/sdk'

// Приглашение в таксопарк через диплинк водительского бота: парк генерирует QR
// со ссылкой https://t.me/<driverBot>?startapp=park_<token>. Водитель сканирует,
// Telegram открывает мини-апп и кладёт параметр в tgWebAppStartParam — здесь мы
// его перехватываем, храним до авторизации и отдаём приложению, чтобы показать
// подтверждение «вступить / сменить парк» и вызвать acceptParkInvite(token).

const PENDING_KEY = 'edtaxi:pending-park-invite'
const START_PREFIX = 'park_'

function extractToken(param: unknown): string {
  if (typeof param !== 'string' || !param.startsWith(START_PREFIX))
    return ''
  return param.slice(START_PREFIX.length).trim()
}

// captureParkInviteStartParam вызывается на старте приложения: вытаскивает токен
// приглашения из параметров запуска Telegram (или из URL в обычном браузере) и
// сохраняет его до подтверждения. Ничего не запрашивает и не падает.
export function captureParkInviteStartParam(): void {
  if (typeof window === 'undefined')
    return

  let token = ''

  try {
    const params = retrieveLaunchParams() as Record<string, unknown>
    token = extractToken(params.tgWebAppStartParam)
  }
  catch {}

  if (!token) {
    try {
      const query = new URLSearchParams(window.location.search)
      token = extractToken(query.get('tgWebAppStartParam') ?? query.get('startapp') ?? '')
    }
    catch {}
  }

  if (!token)
    return

  try {
    localStorage.setItem(PENDING_KEY, token)
  }
  catch {}
}

// takePendingParkInviteToken отдаёт сохранённый токен ровно один раз: приложение
// делает одну попытку вступления, повторные открытия той же ссылки не создают
// новых запросов.
export function takePendingParkInviteToken(): null | string {
  try {
    const token = localStorage.getItem(PENDING_KEY)
    if (token)
      localStorage.removeItem(PENDING_KEY)
    return token
  }
  catch {
    return null
  }
}

// buildParkInviteDeepLink — ссылка, открывающая мини-апп водительского бота с
// токеном приглашения. botUsername — username водительского бота (без @).
export function buildParkInviteDeepLink(botUsername: string, token: string): string {
  return `https://t.me/${botUsername}?startapp=${START_PREFIX}${token.trim()}`
}
