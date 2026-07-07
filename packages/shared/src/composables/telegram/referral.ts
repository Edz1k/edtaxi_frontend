import { retrieveLaunchParams } from '@telegram-apps/sdk'

// Рефералка через диплинк бота: «Поделиться» шлёт ссылку
// https://t.me/<bot>?startapp=ref_<КОД>. Telegram открывает мини-апп и кладёт
// параметр в tgWebAppStartParam — здесь мы его перехватываем, сохраняем до
// момента авторизации и отдаём приложению для автопогашения кода.

const PENDING_KEY = 'edtaxi:pending-referral'
const START_PREFIX = 'ref_'

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase()
}

function extractCode(param: unknown): string {
  if (typeof param !== 'string' || !param.startsWith(START_PREFIX))
    return ''
  return normalizeCode(param.slice(START_PREFIX.length))
}

// captureReferralStartParam вызывается на старте приложения: вытаскивает код из
// параметров запуска Telegram (или из URL, если открыли в обычном браузере) и
// сохраняет его до автопогашения. Ничего не запрашивает и не падает.
export function captureReferralStartParam(): void {
  if (typeof window === 'undefined')
    return

  let code = ''

  try {
    const params = retrieveLaunchParams() as Record<string, unknown>
    code = extractCode(params.tgWebAppStartParam)
  }
  catch {}

  if (!code) {
    try {
      const query = new URLSearchParams(window.location.search)
      code = extractCode(query.get('tgWebAppStartParam') ?? query.get('startapp') ?? '')
    }
    catch {}
  }

  if (!code)
    return

  try {
    localStorage.setItem(PENDING_KEY, code)
  }
  catch {}
}

// takePendingReferralCode отдаёт сохранённый код ровно один раз: приложение
// делает одну попытку погашения, повторные открытия той же ссылки не
// генерируют новых запросов (бэкенд всё равно отверг бы их по UNIQUE).
export function takePendingReferralCode(): null | string {
  try {
    const code = localStorage.getItem(PENDING_KEY)
    if (code)
      localStorage.removeItem(PENDING_KEY)
    return code
  }
  catch {
    return null
  }
}

// buildReferralDeepLink — ссылка, открывающая мини-апп бота с кодом друга.
export function buildReferralDeepLink(botUsername: string, code: string): string {
  return `https://t.me/${botUsername}?startapp=${START_PREFIX}${normalizeCode(code)}`
}

// buildReferralShareUrl — экран «Поделиться» Telegram с диплинком и текстом.
export function buildReferralShareUrl(botUsername: string, code: string, text: string): string {
  const link = buildReferralDeepLink(botUsername, code)
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
}
