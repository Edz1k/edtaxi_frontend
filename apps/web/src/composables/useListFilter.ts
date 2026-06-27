export function useListFilter<T extends string>(initial: T | '' = '') {
  const value = ref<T | ''>(initial)
  return { value, model: value }
}
