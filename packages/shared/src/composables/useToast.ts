export type ToastKind = 'error' | 'info' | 'success' | 'warning'

export interface AppToast {
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
    error: (title: string, description?: string) => addToast({ description, kind: 'error', title }),
    info: (title: string, description?: string) => addToast({ description, kind: 'info', title }),
    removeToast,
    success: (title: string, description?: string) => addToast({ description, kind: 'success', title }),
    toasts,
    warning: (title: string, description?: string) => addToast({ description, kind: 'warning', title }),
  }
}
