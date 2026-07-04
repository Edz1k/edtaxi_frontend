// Список аккаунтов, под которыми пользователь входил на этом устройстве.
// Показывается на странице выбора аккаунта после «Выйти»: тап по аккаунту
// подставляет номер в форму входа, чтобы не вводить его заново. Токены здесь
// НЕ хранятся (они в httpOnly-cookie) — это только витрина для удобства.
// storageKey передаётся приложением, чтобы пассажирский и водительский
// мини-аппы на одном origin не смешивали списки.

export interface SavedAccount {
  avatarUrl: null | string
  firstName: null | string
  id: string
  lastLoginAt: number
  lastName: null | string
  phone: string
  role: null | string
}

const MAX_SAVED_ACCOUNTS = 5

function canUseStorage() {
  return typeof window !== 'undefined'
}

export function readSavedAccounts(storageKey: string): SavedAccount[] {
  if (!canUseStorage())
    return []

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw)
      return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed))
      return []

    return parsed.filter((account): account is SavedAccount =>
      typeof account === 'object' && account !== null
      && typeof (account as SavedAccount).id === 'string'
      && typeof (account as SavedAccount).phone === 'string',
    )
  }
  catch {
    return []
  }
}

function writeSavedAccounts(storageKey: string, accounts: SavedAccount[]) {
  if (!canUseStorage())
    return

  try {
    localStorage.setItem(storageKey, JSON.stringify(accounts))
  }
  catch {
    // localStorage недоступен (приватный режим/квота) — список просто не сохранится
  }
}

// rememberAccount добавляет/обновляет аккаунт в списке при успешном входе.
// Аккаунты с плейсхолдер-номером (tg_<id>, номер ещё не привязан) не
// запоминаем: по такому номеру нельзя войти заново.
export function rememberAccount(storageKey: string, account: Omit<SavedAccount, 'lastLoginAt'>) {
  if (!account.phone || account.phone.startsWith('tg_'))
    return

  const rest = readSavedAccounts(storageKey).filter(saved => saved.id !== account.id)
  const updated = [{ ...account, lastLoginAt: Date.now() }, ...rest].slice(0, MAX_SAVED_ACCOUNTS)
  writeSavedAccounts(storageKey, updated)
}

export function forgetAccount(storageKey: string, id: string) {
  writeSavedAccounts(storageKey, readSavedAccounts(storageKey).filter(saved => saved.id !== id))
}

export function savedAccountDisplayName(account: SavedAccount) {
  const name = [account.firstName, account.lastName].filter(Boolean).join(' ').trim()
  return name || account.phone
}
