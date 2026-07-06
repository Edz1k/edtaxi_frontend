import { ref } from 'vue'

// usePhotoCapture — связка «шторка выбора источника → редактор → готовый File»
// для PhotoSourceSheet + PhotoEditorModal, чтобы каждая страница не собирала
// этот флоу заново. onReady получает уже отредактированный JPEG.
export function usePhotoCapture(onReady: (file: File) => Promise<void> | void) {
  const isSourceOpen = ref(false)
  const editorFile = ref<File | null>(null)

  function open() {
    isSourceOpen.value = true
  }

  function closeSource() {
    isSourceOpen.value = false
  }

  function onSelected(file: File) {
    isSourceOpen.value = false
    editorFile.value = file
  }

  function onCancel() {
    editorFile.value = null
  }

  async function onDone(file: File) {
    editorFile.value = null
    await onReady(file)
  }

  return { closeSource, editorFile, isSourceOpen, onCancel, onDone, onSelected, open }
}
