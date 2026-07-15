<script setup lang="ts">
import { buildParkInviteDeepLink } from '@edtaxi/shared/composables/telegram/parkInvite'
import QRCode from 'qrcode'
import ParkModal from '~/components/park/ParkModal.vue'
import { TG_DRIVER_BOT_USERNAME } from '~/constants/telegram'

const props = defineProps<{
  token: string
}>()

const open = defineModel<boolean>({ required: true })

const link = computed(() => buildParkInviteDeepLink(TG_DRIVER_BOT_USERNAME, props.token))
const qrImage = ref('')

const { copy, copied } = useClipboard({ legacy: true })

// QR генерим при каждом открытии: токен мог быть перевыпущен.
watch(open, async (isOpen) => {
  if (!isOpen)
    return
  qrImage.value = ''
  try {
    qrImage.value = await QRCode.toDataURL(link.value, {
      width: 320,
      margin: 2,
      color: { dark: '#06142f', light: '#ffffff' },
    })
  }
  catch {
    qrImage.value = ''
  }
})
</script>

<template>
  <ParkModal v-model="open">
    <div class="max-w-sm w-full border border-white/10 rounded-3xl bg-#071a38 p-6 text-center shadow-2xl">
      <h2 class="text-xl font-950">
        Пригласить водителя
      </h2>
      <p class="mt-1 text-sm text-white/55 leading-5">
        Водитель сканирует QR — приложение предложит вступить в парк (или сменить текущий).
      </p>

      <div class="mt-5 flex justify-center">
        <div class="border border-white/10 rounded-2xl bg-white p-3">
          <img v-if="qrImage" alt="QR-приглашение" class="h-56 w-56" :src="qrImage">
          <div v-else class="h-56 w-56 flex items-center justify-center text-sm text-#06142f/60">
            Генерируем...
          </div>
        </div>
      </div>

      <p class="mt-4 break-all text-xs text-white/45 font-mono">
        {{ link }}
      </p>

      <div class="mt-4 flex gap-3">
        <button
          class="h-11 flex-1 rounded-2xl bg-cyan-300 text-sm text-#06142f font-900 transition hover:bg-cyan-200"
          type="button"
          @click="copy(link)"
        >
          {{ copied ? 'Скопировано' : 'Копировать ссылку' }}
        </button>
        <button
          class="h-11 border border-white/12 rounded-2xl bg-white/8 px-5 text-sm font-900 transition hover:bg-white/12"
          type="button"
          @click="open = false"
        >
          Закрыть
        </button>
      </div>
    </div>
  </ParkModal>
</template>
