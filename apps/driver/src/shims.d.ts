declare interface Window {
  // extend the window
}

// with unplugin-vue-markdown, markdown files can be treated as Vue components
declare module '*.md' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, any>
  export default component
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, any>
  export default component
}

// yml-словари i18n импортируются как объект сообщений (тесты, unplugin-vue-i18n).
declare module '*.yml' {
  const messages: Record<string, unknown>
  export default messages
}
