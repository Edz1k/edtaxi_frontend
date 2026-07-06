<script setup lang="ts">
import { ref } from 'vue'

// Шторка выбора источника фото: «Снять на камеру» или «Выбрать из галереи».
// Раньше стоял один input с capture — iPhone сразу открывал камеру (нельзя
// выбрать готовое фото 3×4 из галереи), а Android показывал только галерею.
// Два отдельных input дают одинаковое поведение на обеих платформах.
withDefaults(defineProps<{
  open: boolean
  // Какую камеру просить: user — фронтальная (селфи), environment — задняя.
  cameraFacing?: 'environment' | 'user'
  title?: string
}>(), {
  cameraFacing: 'environment',
  title: 'Добавить фото',
})

const emit = defineEmits<{
  close: []
  selected: [file: File]
}>()

const cameraInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)

function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // повторный выбор того же файла тоже должен сработать
  if (file)
    emit('selected', file)
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[94] flex items-end bg-black/65 px-4 pb-[calc(var(--app-safe-area-bottom,0px)+1rem)]"
        @click.self="emit('close')"
      >
        <section class="mx-auto max-w-sm w-full rounded-3xl bg-secondary-900 p-4 text-white shadow-2xl shadow-black/30">
          <div class="flex items-center justify-between gap-3 px-1 pb-3">
            <h2 class="text-base font-950">
              {{ title }}
            </h2>
            <button
              aria-label="Закрыть выбор фото"
              class="h-9 w-9 flex items-center justify-center rounded-full bg-white/8"
              type="button"
              @click="emit('close')"
            >
              <span class="i-mdi-close text-5" />
            </button>
          </div>

          <div class="space-y-2">
            <button
              class="h-14 w-full flex items-center gap-3 rounded-2xl bg-white/6 px-4 text-left transition active:scale-[0.98]"
              type="button"
              @click="galleryInput?.click()"
            >
              <span class="h-10 w-10 flex shrink-0 items-center justify-center rounded-xl bg-main-500/16 text-main-300">
                <span class="i-mdi-image-multiple text-5.5" />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-900">Выбрать из галереи</span>
                <span class="block text-xs text-slate-400 font-700">Готовое фото с телефона</span>
              </span>
            </button>

            <button
              class="h-14 w-full flex items-center gap-3 rounded-2xl bg-white/6 px-4 text-left transition active:scale-[0.98]"
              type="button"
              @click="cameraInput?.click()"
            >
              <span class="h-10 w-10 flex shrink-0 items-center justify-center rounded-xl bg-main-500/16 text-main-300">
                <span class="i-mdi-camera text-5.5" />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-900">Сфотографировать сейчас</span>
                <span class="block text-xs text-slate-400 font-700">Откроется камера</span>
              </span>
            </button>
          </div>

          <!-- Галерея: БЕЗ capture — обе платформы показывают выбор файла. -->
          <input
            ref="galleryInput"
            accept="image/*"
            class="hidden"
            type="file"
            @change="onFilePicked"
          >
          <!-- Камера: capture заставляет iOS/Android открыть камеру сразу. -->
          <input
            ref="cameraInput"
            accept="image/*"
            :capture="cameraFacing"
            class="hidden"
            type="file"
            @change="onFilePicked"
          >
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
