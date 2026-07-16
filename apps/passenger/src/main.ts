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

// Стартовый экран из index.html (см. #app-splash): показывается всё время, пока
// грузится бандл и authGuard ждёт restoreSession, и уходит, когда приложение
// смонтировано. finally, а не then: если первая навигация упала, лучше показать
// пустой экран (как было до сплэша), чем вечный спиннер.
function hideSplash() {
  const splash = document.getElementById('app-splash')
  if (!splash)
    return

  splash.setAttribute('data-hidden', '')
  splash.addEventListener('transitionend', () => splash.remove(), { once: true })
  // Страховка: transitionend может не прийти (прерванный переход, вкладка в фоне).
  setTimeout(() => splash.remove(), 600)
}

router.isReady()
  .then(() => {
    app.mount('#app')
  })
  .finally(hideSplash)
