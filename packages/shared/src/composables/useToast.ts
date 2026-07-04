import { ref } from 'vue'

export type ToastKind = 'error' | 'info' | 'success' | 'warning'

// ToastAction делает тост нажимным: тап по телу тоста вызывает onClick (например
// «Геолокация недоступна» → открыть экран согласия). Тост с action не исчезает
// автоматически (persist), чтобы у пользователя было время нажать.
export interface ToastAction {
  onClick: () => void
}

export interface AppToast {
  action?: ToastAction
  description?: string
  id: number
  kind: ToastKind
  title: string
}

const toasts = ref<AppToast[]>([])
let nextToastID = 1

function addToast(toast: Omit<AppToast, 'id'>) {
  const id = nextToastID++
  toasts.value = [...toasts.value, { ...toast, id }]
  return id
}

function removeToast(id: number) {
  toasts.value = toasts.value.filter(toast => toast.id !== id)
}

export function useToast() {
  return {
    error: (title: string, description?: string, action?: ToastAction) => addToast({ action, description, kind: 'error', title }),
    info: (title: string, description?: string, action?: ToastAction) => addToast({ action, description, kind: 'info', title }),
    removeToast,
    success: (title: string, description?: string, action?: ToastAction) => addToast({ action, description, kind: 'success', title }),
    toasts,
    warning: (title: string, description?: string, action?: ToastAction) => addToast({ action, description, kind: 'warning', title }),
  }
}
