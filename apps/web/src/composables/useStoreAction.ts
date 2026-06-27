import type { Ref } from 'vue'
import { showErrorToast } from '~/api/errors'

export function useStoreAction(errorMessage: Ref<string>) {
  async function withLoading<T>(
    loadingRef: Ref<boolean>,
    fn: () => Promise<T>,
    fallback: string,
  ): Promise<T> {
    loadingRef.value = true
    errorMessage.value = ''
    try {
      return await fn()
    }
    catch (error) {
      errorMessage.value = showErrorToast(error, fallback)
      throw error
    }
    finally {
      loadingRef.value = false
    }
  }

  return { withLoading }
}
