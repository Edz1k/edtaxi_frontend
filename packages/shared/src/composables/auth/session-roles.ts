import type { AuthRole, AuthSession } from '../../types/auth'

// Order in which roles are preferred when a session carries several of them.
// Passenger and driver apps share this exact resolution logic.
export const ROLE_PRIORITY: AuthRole[] = ['passenger', 'driver', 'admin', 'superadmin', 'tech_support', 'park']

export function isAuthRole(role: string): role is AuthRole {
  return ROLE_PRIORITY.includes(role as AuthRole)
}

export function pickSessionRole(sessionRoles: AuthRole[], preferredRole?: AuthRole | null) {
  if (preferredRole && sessionRoles.includes(preferredRole))
    return preferredRole

  return ROLE_PRIORITY.find(role => sessionRoles.includes(role)) ?? null
}

// Normalizes a raw server session: dedupes/validates its roles, resolves the
// active role (honouring a preferred role when the session actually has it),
// and returns null when the session carries no role we recognize.
export function normalizeSession(session: AuthSession, preferredRole?: AuthRole | null): AuthSession | null {
  const rawRoles = session.roles?.length
    ? session.roles
    : session.role
      ? [session.role]
      : []
  const sessionRoles = Array.from(new Set(rawRoles.filter(isAuthRole)))
  const nextRole = pickSessionRole(sessionRoles, preferredRole)

  if (!nextRole)
    return null

  return {
    ...session,
    role: nextRole,
    roles: sessionRoles,
  }
}
