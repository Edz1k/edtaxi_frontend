<script setup lang="ts">
import type { CarCatalogRequest } from '~/types/carRequest'
import { listMyCarRequests, submitCarRequest } from '~/api/carRequest'
import { useToast } from '~/composables/useToast'
import { carRequestSubmitError } from '~/utils/carRequestErrors'

// Показывается, когда модель не нашлась в каталоге (vehicle.vue). Даёт водителю
// отправить заявку на добавление модели вместо тупика «обратитесь в поддержку».
const props = defineProps<{
  make: string
  model: string
  year: number
}>()

const toast = useToast()

const isOpen = ref(false)
const comment = ref('')
const isSubmitting = ref(false)
const submitted = ref(false)
// Заявка на текущую модель, если она уже подавалась (pending — ждёт, rejected —
// с причиной): подтягивается при монтировании, чтобы не давать подать дубль.
const existing = ref<CarCatalogRequest | null>(null)

const canSubmit = computed(() => props.make.trim() && props.model.trim() && !isSubmitting.value)

function sameModel(r: CarCatalogRequest) {
  return r.make.trim().toLowerCase() === props.make.trim().toLowerCase()
    && r.model.trim().toLowerCase() === props.model.trim().toLowerCase()
}

async function loadExisting() {
  try {
    const res = await listMyCarRequests()
    // Самая свежая заявка на текущую модель (список отсортирован по created_at DESC).
    existing.value = res.requests.find(sameModel) ?? null
  }
  catch {
    // Старый бэк без роута / сеть — просто не показываем статус, кнопка остаётся.
    existing.value = null
  }
}

async function submit() {
  if (!canSubmit.value)
    return

  isSubmitting.value = true
  try {
    await submitCarRequest({
      make: props.make.trim(),
      model: props.model.trim(),
      year: props.year,
      comment: comment.value.trim() || undefined,
    })
    submitted.value = true
    isOpen.value = false
    toast.success('Заявка отправлена', 'Поддержка проверит модель и добавит её в каталог.')
    await loadExisting()
  }
  catch (error) {
    toast.error('Не получилось', carRequestSubmitError(error))
  }
  finally {
    isSubmitting.value = false
  }
}

onMounted(loadExisting)
</script>

<template>
  <div class="mt-3">
    <!-- Уже есть заявка на эту модель -->
    <div v-if="existing" class="rounded-xl bg-white/5 p-3 text-xs leading-5">
      <p v-if="existing.status === 'pending'" class="text-amber-300 font-800">
        Заявка на добавление модели на рассмотрении.
      </p>
      <p v-else-if="existing.status === 'rejected'" class="text-red-300 font-800">
        Заявку отклонили{{ existing.rejection_reason ? `: ${existing.rejection_reason}` : '' }}
      </p>
      <p v-else class="text-emerald-300 font-800">
        Модель добавлена в каталог.
      </p>
    </div>

    <!-- Только что отправили -->
    <p v-else-if="submitted" class="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-300 font-800 leading-5">
      Заявка отправлена — поддержка проверит модель.
    </p>

    <!-- Кнопка + форма -->
    <template v-else>
      <button
        v-if="!isOpen"
        class="w-full rounded-xl bg-main-500/16 py-2.5 text-xs text-main-200 font-800 transition active:scale-[0.99]"
        type="button"
        @click="isOpen = true"
      >
        Отправить заявку на добавление в каталог
      </button>

      <div v-else class="space-y-3">
        <label class="block">
          <span class="mb-1.5 block text-xs text-slate-400 font-600">Комментарий (необязательно)</span>
          <textarea
            v-model="comment"
            class="min-h-16 w-full border border-white/10 rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-main-400"
            maxlength="1000"
            placeholder="Комплектация, поколение, ссылка — что поможет проверить"
          />
        </label>
        <div class="grid grid-cols-2 gap-2">
          <button
            class="h-11 rounded-xl bg-white/6 text-xs text-slate-300 font-800 transition active:scale-[0.98]"
            type="button"
            @click="isOpen = false"
          >
            Отмена
          </button>
          <button
            :disabled="!canSubmit"
            class="h-11 rounded-xl bg-main-500 text-xs text-white font-900 transition active:scale-[0.98] disabled:opacity-60"
            type="button"
            @click="submit"
          >
            {{ isSubmitting ? 'Отправка…' : 'Отправить' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
