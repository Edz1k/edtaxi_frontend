import type { UserModule } from '~/types'
import type { AuthRole } from '~/types/auth'
import { useAuthStore } from '~/stores/auth'

type RouteRole = AuthRole | AuthRole[]

declare module 'vue-router' {
  interface RouteMeta {
    authRedirect?: string
    guestRedirect?: string
    guestOnly?: boolean
    guestOnlyRole?: RouteRole
    // holdSplash — экран сам снимет стартовый сплэш, когда будет реально готов
    // (карта: отрисовка + геопозиция). Без флага сплэш уходит сразу после
    // монтирования, потому что ждать нечего. См. useAppSplash.
    holdSplash?: boolean
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

function canAccessRole(currentRole: AuthRole | null, requiredRole: RouteRole | undefined) {
  const required = toRoleList(requiredRole)

  if (!required.length)
    return true

  if (!currentRole)
    return false

  // superadmin и admin обходят все проверки ролей (mirrors backend RequireRole middleware)
  if (currentRole === 'superadmin' || currentRole === 'admin')
    return true

  return required.includes(currentRole)
}

export const install: UserModule = ({ router }) => {
  router.beforeEach(async (to) => {
    if (import.meta.env.SSR && import.meta.env.PROD)
      return

    const auth = useAuthStore()

    auth.loadSession()

    if (to.meta.requiresAuth || to.meta.requiredRole || to.meta.guestOnly || to.meta.requiresPendingPhone) {
      const routeRole = to.meta.requiredRole ?? to.meta.guestOnlyRole
      const preferredRole = Array.isArray(routeRole) ? routeRole[0] : routeRole
      try {
        await auth.restoreSession({ preferredRole })
      }
      catch {
        if (to.meta.requiresAuth || to.meta.requiredRole)
          return to.meta.authRedirect ?? '/login'
      }
    }

    // Номер телефона обязателен: вошедший через Telegram без привязанного
    // номера не идёт дальше экрана «Подтвердите номер».
    if (auth.isAuthenticated && !auth.phoneVerified && to.path !== '/login/phone')
      return '/login/phone'

    if (to.meta.requiresPendingPhone && !auth.pendingPhone)
      return to.meta.authRedirect ?? '/login'

    if (to.meta.guestOnly && auth.isAuthenticated && canAccessRole(auth.role, to.meta.guestOnlyRole))
      return to.meta.guestRedirect ?? '/'

    if (to.meta.requiresAuth && !auth.isAuthenticated)
      return to.meta.authRedirect ?? '/login'

    if (to.meta.requiredRole && !canAccessRole(auth.role, to.meta.requiredRole))
      return to.meta.roleRedirect ?? to.meta.authRedirect ?? '/login'
  })
}
