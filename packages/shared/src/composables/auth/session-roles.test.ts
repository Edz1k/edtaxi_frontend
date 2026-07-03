import type { AuthRole, AuthSession } from '../../types/auth'
import { describe, expect, it } from 'vitest'
import { isAuthRole, normalizeSession, pickSessionRole } from './session-roles'

function makeSession(overrides: Partial<AuthSession>): AuthSession {
  return {
    avatar_url: null,
    first_name: null,
    id: 'u1',
    last_name: null,
    phone: '+70000000000',
    roles: [],
    telegram_user_id: null,
    ...overrides,
  }
}

describe('isAuthRole', () => {
  it('accepts known roles and rejects unknown ones', () => {
    expect(isAuthRole('driver')).toBe(true)
    expect(isAuthRole('superadmin')).toBe(true)
    expect(isAuthRole('wizard')).toBe(false)
    expect(isAuthRole('')).toBe(false)
  })
})

describe('pickSessionRole', () => {
  it('returns the highest-priority role by default', () => {
    expect(pickSessionRole(['driver', 'passenger'])).toBe('passenger')
    expect(pickSessionRole(['park', 'admin'])).toBe('admin')
  })

  it('honours a preferred role the session actually has', () => {
    expect(pickSessionRole(['passenger', 'driver'], 'driver')).toBe('driver')
  })

  it('ignores a preferred role the session does not have', () => {
    expect(pickSessionRole(['passenger'], 'driver')).toBe('passenger')
  })

  it('returns null for an empty role list', () => {
    expect(pickSessionRole([])).toBeNull()
  })
})

describe('normalizeSession', () => {
  it('resolves the active role from the roles array', () => {
    const result = normalizeSession(makeSession({ roles: ['driver', 'passenger'] }))
    expect(result?.role).toBe('passenger')
    expect(result?.roles).toEqual(['driver', 'passenger'])
  })

  it('applies the preferred role when present', () => {
    const result = normalizeSession(makeSession({ roles: ['passenger', 'driver'] }), 'driver')
    expect(result?.role).toBe('driver')
  })

  it('falls back to the singular role field when roles is empty', () => {
    const result = normalizeSession(makeSession({ roles: [], role: 'driver' }))
    expect(result?.role).toBe('driver')
    expect(result?.roles).toEqual(['driver'])
  })

  it('dedupes roles and drops unrecognized ones', () => {
    const result = normalizeSession(
      makeSession({ roles: ['passenger', 'passenger', 'bogus' as AuthRole] }),
    )
    expect(result?.roles).toEqual(['passenger'])
  })

  it('returns null when the session carries no recognized role', () => {
    expect(normalizeSession(makeSession({ roles: ['bogus' as AuthRole] }))).toBeNull()
    expect(normalizeSession(makeSession({ roles: [] }))).toBeNull()
  })
})
