import { ref } from 'vue'

export function useShakeAnimation() {
  const shouldShake = ref(false)
  function shake() {
    shouldShake.value = false
    requestAnimationFrame(() => {
      shouldShake.value = true
      window.setTimeout(() => {
        shouldShake.value = false
      }, 380)
    })
  }
  return { shouldShake, shake }
}
