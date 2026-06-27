import type { UserModule } from './types'

import { createHead } from '@unhead/vue/client'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp as createVueApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from './App.vue'

import '@unocss/reset/tailwind.css'
import './styles/main.css'
import 'uno.css'

const app = createVueApp(App)
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: setupLayouts([...routes]),
})
const head = createHead()

app.use(head)

Object.values(import.meta.glob<{ install: UserModule }>('./modules/*.ts', { eager: true }))
  .forEach(i => i.install?.({
    app,
    isClient: true,
    router,
  }))

app.use(router)

router.isReady().then(() => {
  app.mount('#app')
})
