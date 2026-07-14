<script setup lang="ts">
import type { CreatePromotionPayload, PromotionAudience, PromotionImageUpload, PromotionScope } from '~/types/promotions'
import { showErrorToast } from '~/api/errors'

const props = withDefaults(defineProps<{
  // Подпись рядом с кнопкой запуска — кого уведомит бэкенд.
  hint: string
  pending?: boolean
  // Загрузчик баннера своего скоупа (админ/парк) — страница прокидывает
  // uploadAdminPromotionImage или uploadParkPromotionImage.
  uploadImage: (file: File) => Promise<PromotionImageUpload>
  // Выбор аудитории показываем только для платформенных акций (админка).
  withAudience?: boolean
}>(), {
  pending: false,
  withAudience: false,
})

const emit = defineEmits<{
  create: [payload: CreatePromotionPayload]
}>()

const AUDIENCES: Array<{ label: string, value: PromotionScope }> = [
  { label: 'Пассажиры', value: 'platform_passenger' },
  { label: 'Водители', value: 'platform_driver' },
]

// Для водительских платформенных акций: только водители платформенного парка
// (по умолчанию) или «акция для всех» — отдельная кнопка (решение владельца).
const DRIVER_AUDIENCES: Array<{ label: string, value: PromotionAudience }> = [
  { label: 'Водители платформы', value: 'platform' },
  { label: 'Все водители', value: 'all' },
]

const MESSAGE_MODES: Array<{ label: string, value: 'custom' | 'template' }> = [
  { label: 'Шаблонный', value: 'template' },
  { label: 'Свой', value: 'custom' },
]

const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png']

const form = reactive({
  scope: 'platform_passenger' as PromotionScope,
  audience: 'platform' as PromotionAudience,
  title: '',
  description: '',
  target_trips: 5,
  reward: 1000,
  ends_at: '',
  messageMode: 'template' as 'custom' | 'template',
  message: '',
})

// path загруженного баннера (уходит в payload) и превью выбранного файла.
const imagePath = ref('')
const imagePreview = ref('')
const isUploadingImage = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const canSubmit = computed(() => !!form.title.trim() && form.target_trips > 0 && form.reward > 0 && !!form.ends_at && !isUploadingImage.value)

function clearPreview() {
  if (imagePreview.value)
    URL.revokeObjectURL(imagePreview.value)
  imagePreview.value = ''
}

function removeImage() {
  clearPreview()
  imagePath.value = ''
  if (fileInput.value)
    fileInput.value.value = ''
}

async function onImageSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return

  if (!IMAGE_TYPES.includes(file.type)) {
    showErrorToast(null, 'Баннер должен быть в формате JPEG или PNG.')
    removeImage()
    return
  }
  if (file.size > IMAGE_MAX_BYTES) {
    showErrorToast(null, 'Файл слишком большой — до 5 МБ.')
    removeImage()
    return
  }

  isUploadingImage.value = true
  try {
    const uploaded = await props.uploadImage(file)
    imagePath.value = uploaded.path
    clearPreview()
    imagePreview.value = URL.createObjectURL(file)
  }
  catch (error) {
    showErrorToast(error, 'Не удалось загрузить баннер.')
    removeImage()
  }
  finally {
    isUploadingImage.value = false
  }
}

function submit() {
  if (!canSubmit.value || props.pending)
    return
  emit('create', {
    scope: props.withAudience ? form.scope : undefined,
    audience: props.withAudience && form.scope === 'platform_driver' ? form.audience : undefined,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    target_trips: form.target_trips,
    reward: form.reward,
    // datetime-local отдаёт локальное время без зоны — бэкенд ждёт RFC3339.
    ends_at: new Date(form.ends_at).toISOString(),
    image_path: imagePath.value || undefined,
    // Пустой message = шаблонное уведомление «...запустил акцию».
    message: form.messageMode === 'custom' ? form.message.trim() || undefined : undefined,
  })
}

// Родитель сбрасывает форму после успешного создания акции.
function reset() {
  form.scope = 'platform_passenger'
  form.audience = 'platform'
  form.title = ''
  form.description = ''
  form.target_trips = 5
  form.reward = 1000
  form.ends_at = ''
  form.messageMode = 'template'
  form.message = ''
  removeImage()
}

onBeforeUnmount(clearPreview)

defineExpose({ reset })
</script>

<template>
  <section class="mt-6 border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
    <h2 class="text-xl font-950">
      Новая акция
    </h2>

    <form class="grid mt-4 gap-4" @submit.prevent="submit()">
      <div v-if="withAudience" class="grid gap-1.5">
        <span class="text-xs text-white/42 font-900 uppercase">Аудитория</span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="audience in AUDIENCES"
            :key="audience.value"
            class="h-10 rounded-xl px-4 text-sm font-900 transition active:scale-[0.97]"
            :class="form.scope === audience.value ? 'bg-cyan-400 text-#06142f' : 'bg-white/8 text-white/70 hover:bg-white/12'"
            type="button"
            @click="form.scope = audience.value"
          >
            {{ audience.label }}
          </button>
        </div>
      </div>

      <!-- Водительская платформенная акция: водители платформы или все -->
      <div v-if="withAudience && form.scope === 'platform_driver'" class="grid gap-1.5">
        <span class="text-xs text-white/42 font-900 uppercase">Кто участвует</span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="driverAudience in DRIVER_AUDIENCES"
            :key="driverAudience.value"
            class="h-10 rounded-xl px-4 text-sm font-900 transition active:scale-[0.97]"
            :class="form.audience === driverAudience.value ? 'bg-cyan-400 text-#06142f' : 'bg-white/8 text-white/70 hover:bg-white/12'"
            type="button"
            @click="form.audience = driverAudience.value"
          >
            {{ driverAudience.label }}
          </button>
        </div>
        <p class="text-xs text-white/45">
          Награды по водительским акциям отправляются вручную после завершения акции — кнопкой «Отправить награды» в списке ниже.
        </p>
      </div>

      <label class="grid gap-1.5">
        <span class="text-xs text-white/42 font-900 uppercase">Название</span>
        <input
          v-model="form.title"
          class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
          maxlength="200"
          placeholder="Например: 5 поездок — 1000 бонусов"
          type="text"
        >
      </label>

      <label class="grid gap-1.5">
        <span class="text-xs text-white/42 font-900 uppercase">Описание (необязательно)</span>
        <textarea
          v-model="form.description"
          class="w-full border border-white/10 rounded-xl bg-white/8 px-4 py-3 text-sm outline-none focus:border-cyan-300/40"
          maxlength="500"
          placeholder="Условия акции, которые увидят участники..."
          rows="2"
        />
      </label>

      <div class="grid gap-4 sm:grid-cols-3">
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Поездок для награды</span>
          <input
            v-model.number="form.target_trips"
            class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
            min="1"
            step="1"
            type="number"
          >
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Награда, бонусов</span>
          <input
            v-model.number="form.reward"
            class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
            min="1"
            step="50"
            type="number"
          >
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs text-white/42 font-900 uppercase">Действует до</span>
          <input
            v-model="form.ends_at"
            class="h-11 w-full border border-white/10 rounded-xl bg-white/8 px-4 text-sm outline-none focus:border-cyan-300/40"
            type="datetime-local"
          >
        </label>
      </div>

      <div class="grid gap-1.5">
        <span class="text-xs text-white/42 font-900 uppercase">Баннер (необязательно)</span>
        <div class="flex flex-wrap items-center gap-3">
          <img
            v-if="imagePreview"
            alt="Баннер акции"
            class="max-h-28 border border-white/10 rounded-2xl object-cover"
            :src="imagePreview"
          >
          <label
            class="h-10 inline-flex cursor-pointer items-center gap-2 border border-white/12 rounded-xl bg-white/8 px-4 text-sm font-900 transition hover:bg-white/12"
            :class="{ 'pointer-events-none opacity-60': isUploadingImage }"
          >
            <span class="text-4.5 text-cyan-200" :class="isUploadingImage ? 'i-mdi-loading animate-spin' : 'i-mdi-image-plus-outline'" />
            {{ isUploadingImage ? 'Загружаем...' : imagePath ? 'Заменить фото' : 'Выбрать фото' }}
            <input
              ref="fileInput"
              accept="image/jpeg,image/png"
              class="hidden"
              type="file"
              @change="onImageSelected"
            >
          </label>
          <button
            v-if="imagePath"
            class="h-10 rounded-xl bg-red-500/12 px-3 text-sm text-red-300 font-900 transition active:scale-[0.98]"
            type="button"
            @click="removeImage()"
          >
            Убрать
          </button>
        </div>
        <p class="text-xs text-white/45">
          JPEG или PNG до 5 МБ. Фото уйдёт вместе с уведомлением в Telegram.
        </p>
      </div>

      <div class="grid gap-1.5">
        <span class="text-xs text-white/42 font-900 uppercase">Текст уведомления</span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="mode in MESSAGE_MODES"
            :key="mode.value"
            class="h-10 rounded-xl px-4 text-sm font-900 transition active:scale-[0.97]"
            :class="form.messageMode === mode.value ? 'bg-cyan-400 text-#06142f' : 'bg-white/8 text-white/70 hover:bg-white/12'"
            type="button"
            @click="form.messageMode = mode.value"
          >
            {{ mode.label }}
          </button>
        </div>
        <textarea
          v-if="form.messageMode === 'custom'"
          v-model="form.message"
          class="w-full border border-white/10 rounded-xl bg-white/8 px-4 py-3 text-sm outline-none focus:border-cyan-300/40"
          maxlength="1000"
          placeholder="Этот текст получат пользователи в Telegram вместе с фото..."
          rows="3"
        />
        <p class="text-xs text-white/45">
          {{ form.messageMode === 'custom'
            ? 'Ваш текст уйдёт пользователям в Telegram вместо шаблонного уведомления (до 1000 символов). Пустое поле — уйдёт шаблон.'
            : 'Уйдёт стандартное уведомление о запуске акции с её условиями.' }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <button
          :disabled="pending || !canSubmit"
          class="h-11 rounded-2xl bg-cyan-300 px-6 text-sm text-#06142f font-900 transition hover:bg-cyan-200 disabled:opacity-60"
          type="submit"
        >
          {{ pending ? 'Запускаем...' : 'Запустить акцию' }}
        </button>
        <p class="max-w-md text-xs text-white/45 leading-5">
          {{ hint }}
        </p>
      </div>
    </form>
  </section>
</template>
