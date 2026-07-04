import { beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetAccount, readSavedAccounts, rememberAccount, savedAccountDisplayName } from '../composables/auth/saved-accounts'

const KEY = 'test_saved_accounts'

// Тесты shared-пакета гоняются в node-окружении — подставляем минимальный
// localStorage (модуль обращается к нему только через эти три метода).
const storage = new Map<string, string>()
vi.stubGlobal('window', {})
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  removeItem: (key: string) => storage.delete(key),
  setItem: (key: string, value: string) => storage.set(key, value),
})

function account(id: string, phone: string, firstName: null | string = null) {
  return { avatarUrl: null, firstName, id, lastName: null, phone, role: 'passenger' }
}

beforeEach(() => {
  storage.clear()
})

describe('saved accounts', () => {
  it('remembers an account and reads it back', () => {
    rememberAccount(KEY, account('u1', '+77010000001', 'Аружан'))

    const accounts = readSavedAccounts(KEY)
    expect(accounts).toHaveLength(1)
    expect(accounts[0].phone).toBe('+77010000001')
  })

  it('moves a re-used account to the top without duplicating it', () => {
    rememberAccount(KEY, account('u1', '+77010000001'))
    rememberAccount(KEY, account('u2', '+77010000002'))
    rememberAccount(KEY, account('u1', '+77010000001'))

    const accounts = readSavedAccounts(KEY)
    expect(accounts.map(a => a.id)).toEqual(['u1', 'u2'])
  })

  it('skips accounts with a tg_ placeholder phone (cannot log in by number)', () => {
    rememberAccount(KEY, account('u3', 'tg_123456'))

    expect(readSavedAccounts(KEY)).toHaveLength(0)
  })

  it('forgets an account by id', () => {
    rememberAccount(KEY, account('u1', '+77010000001'))
    rememberAccount(KEY, account('u2', '+77010000002'))

    forgetAccount(KEY, 'u1')

    expect(readSavedAccounts(KEY).map(a => a.id)).toEqual(['u2'])
  })

  it('returns an empty list for corrupted storage', () => {
    storage.set(KEY, 'not json')

    expect(readSavedAccounts(KEY)).toEqual([])
  })

  it('falls back to the phone when the account has no name', () => {
    expect(savedAccountDisplayName({ ...account('u1', '+77010000001'), lastLoginAt: 1 })).toBe('+77010000001')
    expect(savedAccountDisplayName({ ...account('u1', '+77010000001', 'Олжас'), lastLoginAt: 1 })).toBe('Олжас')
  })
})
