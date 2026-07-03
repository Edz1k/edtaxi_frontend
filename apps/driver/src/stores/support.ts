import { createSupportStore } from '@edtaxi/shared/stores/create-support-store'
import { acceptHMRUpdate } from 'pinia'

export const useSupportStore = createSupportStore('driver')

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useSupportStore as any, import.meta.hot))
