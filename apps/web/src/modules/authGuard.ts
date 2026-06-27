import type { UserModule } from '~/types'
import type { AuthRole } from '~/types/auth'
import { useAuthStore } from '~/stores/auth'

type RouteRole = AuthRole | AuthRole[]
const DEFAULT_AUTH_REDIRECT = '/login'

declare module 'vue-router' {
  interface RouteMeta {
    authRedirect?: string
    guestRedirect?: string
    guestOnly?: boolean
    guestOnlyRole?: RouteRole
    requiresAuth?: boolean
    requiresPendingPhone?: boolean
    requiredRole?: RouteRole
    roleRedirect?: string
  }
}

function toRoleList(role: RouteRole | undefined) {
  if (!role)
    return []

  return Array.isArray(role) ? role : [role]
}

function canAccessRole(currentRoles: AuthRole[], requiredRole: RouteRole | undefined) {
  const required = toRoleList(requiredRole)

  if (!required.length)
    return true

  if (!currentRoles.length)
    return false

  return required.some(role => currentRoles.includes(role))
}

export const install: UserModule = ({ router }) => {
  router.beforeEach(async (to) => {
    if (import.meta.env.SSR && import.meta.env.MODE !== 'test')
      return

    const auth = useAuthStore()

    auth.loadSession()

    if (to.meta.requiresAuth || to.meta.requiredRole || to.meta.guestOnly || to.meta.requiresPendingPhone)
      await auth.restoreSession()

    if (to.meta.requiresPendingPhone && !auth.pendingPhone)
      return to.meta.authRedirect ?? DEFAULT_AUTH_REDIRECT

    if (to.meta.guestOnly && auth.isAuthenticated && canAccessRole(auth.roles, to.meta.guestOnlyRole))
      return to.meta.guestRedirect ?? auth.homePath

    if (to.meta.requiresAuth && !auth.isAuthenticated)
      return to.meta.authRedirect ?? DEFAULT_AUTH_REDIRECT

    if (to.meta.requiredRole && !canAccessRole(auth.roles, to.meta.requiredRole))
      return to.meta.roleRedirect ?? auth.homePath
  })
}
