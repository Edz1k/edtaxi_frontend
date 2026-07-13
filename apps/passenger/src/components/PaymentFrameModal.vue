<script setup lang="ts">
import { mediaUrl } from '~/api/client'

defineProps<{
  url: string
}>()

const emit = defineEmits<{
  close: []
  // Итог оплаты со страницы возврата — родитель может отреагировать
  // (например, объяснить, почему карта не привязалась при успешной оплате).
  result: [status: 'failure' | 'success']
}>()

// После оплаты FreedomPay редиректит фрейм на нашу страницу возврата
// (GET /payments/return на API) — она postMessage'ом просит закрыть фрейм,
// чтобы пользователя не уводило на сторонний сайт из Success URL ЛК.
// mediaUrl('/') даёт базу API; при относительной базе (dev-прокси) origin
// совпадает с origin приложения.
const apiOrigin = new URL(mediaUrl('/') || '/', window.location.href).origin

function onMessage(event: MessageEvent) {
  if (event.origin !== apiOrigin)
    return
  const data = event.data as { status?: string, type?: string } | null
  if (data?.type !== 'edtaxi:payment')
    return
  emit('result', data.status === 'success' ? 'success' : 'failure')
  emit('close')
}

onMounted(() => window.addEventListener('message', onMessage))
onUnmounted(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex flex-col bg-secondary-950">
      <header class="tg-safe-x flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-[calc(var(--app-safe-area-top)+0.75rem)]">
        <p class="text-sm text-white font-900">
          Оплата
        </p>
        <button
          aria-label="Закрыть оплату"
          class="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 text-white"
          type="button"
          @click="emit('close')"
        >
          <span class="i-mdi-close text-5" />
        </button>
      </header>
      <!-- allow="payment" — разрешает Payment Request API (Google Pay) внутри фрейма -->
      <iframe allow="payment *" :src="url" class="w-full flex-1 border-0 bg-white" title="Оплата картой" />
    </div>
  </Teleport>
</template>
