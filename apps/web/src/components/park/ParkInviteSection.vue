<script setup lang="ts">
import type { ParkInvite } from '~/types/park'
import { buildParkInviteDeepLink } from '@edtaxi/shared/composables/telegram/parkInvite'
import ParkInviteQrModal from '~/components/park/ParkInviteQrModal.vue'
import { TG_DRIVER_BOT_USERNAME } from '~/constants/telegram'

const props = defineProps<{
  invite: ParkInvite | null
  isPeeking: boolean
  isMutating: boolean
}>()

defineEmits<{
  create: []
  rotate: []
}>()

const isQrOpen = ref(false)

const { copy, copied } = useClipboard({ legacy: true })

async function copyInviteLink() {
  if (!props.invite)
    return
  await copy(buildParkInviteDeepLink(TG_DRIVER_BOT_USERNAME, props.invite.token))
}
</script>

<template>
  <!-- Ссылка у парка одна и постоянная: её печатают на QR и раздают всем
       водителям. Кнопка не создаёт новую, а перевыпускает — это же
       единственный способ отозвать утёкшую ссылку. -->
  <section class="border border-white/10 rounded-3xl bg-white/8 p-5 backdrop-blur">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-950">
          Приглашение
        </h2>
        <p class="mt-1 text-sm text-white/55">
          Одна ссылка на весь парк: покажите водителю QR — он вступит в один тап.
        </p>
      </div>
      <button
        v-if="!isPeeking && !invite"
        :disabled="isMutating"
        class="h-10 rounded-xl bg-cyan-300 px-4 text-sm text-#06142f font-900 disabled:opacity-60"
        type="button"
        @click="$emit('create')"
      >
        Создать
      </button>
      <button
        v-else-if="!isPeeking"
        :disabled="isMutating"
        class="h-10 rounded-xl bg-white/10 px-4 text-sm font-900 transition hover:bg-white/16 disabled:opacity-60"
        type="button"
        @click="$emit('rotate')"
      >
        Обновить ссылку
      </button>
    </div>

    <div class="grid mt-4 gap-2">
      <p v-if="!invite" class="text-sm text-white/50">
        Ссылка ещё не создана.
      </p>
      <div v-else class="flex flex-wrap items-center gap-3 rounded-xl bg-black/14 p-3">
        <p class="min-w-0 flex-1 break-all text-sm font-900 font-mono">
          {{ invite.token }}
        </p>
        <div class="flex shrink-0 gap-1.5">
          <button
            class="h-8 inline-flex items-center gap-1 rounded-lg bg-white/8 px-3 text-xs font-900 transition hover:bg-white/14"
            type="button"
            @click="copyInviteLink()"
          >
            <span v-if="copied" class="text-emerald-300">Скопировано</span>
            <template v-else>
              <span class="i-mdi-link-variant text-3.5" />
              Ссылка
            </template>
          </button>
          <button
            class="h-8 inline-flex items-center gap-1 rounded-lg bg-cyan-300/14 px-3 text-xs text-cyan-200 font-900 transition hover:bg-cyan-300/22"
            type="button"
            @click="isQrOpen = true"
          >
            <span class="i-mdi-qrcode text-3.5" />
            QR
          </button>
        </div>
      </div>
    </div>

    <ParkInviteQrModal v-if="invite" v-model="isQrOpen" :token="invite.token" />
  </section>
</template>
