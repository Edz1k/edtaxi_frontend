import type { App } from 'vue'
import type { Router } from 'vue-router'

export interface UserModuleContext {
  app: App
  isClient: boolean
  router: Router
}

export type UserModule = (ctx: UserModuleContext) => void
