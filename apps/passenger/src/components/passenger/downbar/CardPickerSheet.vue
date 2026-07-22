<script setup lang="ts">
import type { PaymentCard } from '@edtaxi/shared/types/wallet'
import CardBrandMark from '~/components/CardBrandMark.vue'
import { useWalletStore } from '~/stores/wallet'

// Шит выбора карты для оплаты поездки: тап по карте делает её основной
// (с неё спишется поездка), «Привязать новую» уводит в Кошелёк.
const emit = defineEmits<{ close: [] }>()

const wallet = useWalletStore()
const router = useRouter()

function tailOf(pan?: null | string) {
  const digits = (pan ?? '').replace(/\D/g, '')
  return digits.slice(-4) || '····'
}

async function choose(item: PaymentCard) {
  if (!item.is_default)
    await wallet.setDefaultCard(item.id).catch(() => {})
  emit('close')
}

function goBindNew() {
  emit('close')
  router.push('/wallet')
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-60 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div class="tg-safe-x max-w-sm w-full border app-border rounded-t-[2rem] app-screen p-5 pb-[calc(var(--app-safe-area-bottom)+1.25rem)] text-white">
        <div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/25" />
        <h3 class="text-lg font-950">
          Карта для оплаты
        </h3>
        <p class="mt-1 text-xs app-muted leading-4">
          Поездка спишется с выбранной карты после завершения.
        </p>

        <div class="mt-4 space-y-2">
          <button
            v-for="item in wallet.cards"
            :key="item.id"
            :disabled="wallet.isMutating"
            class="w-full flex items-center gap-3 border rounded-2xl px-3 py-3 text-left transition active:scale-[0.99] disabled:opacity-60"
            :class="item.is_default ? 'border-main-400/60 bg-main-500/12' : 'border-white/8 app-card'"
            type="button"
            @click="choose(item)"
          >
            <span class="h-9 w-12 flex shrink-0 items-center justify-center rounded-lg app-chip">
              <CardBrandMark :brand="item.card_brand" />
            </span>
            <span class="min-w-0 flex-1 text-sm font-900 tracking-wider">
              •••• {{ tailOf(item.card_pan) }}
            </span>
            <span
              v-if="item.is_default"
              class="i-mdi-check-circle shrink-0 text-5 app-accent"
              aria-label="Основная карта"
            />
          </button>
        </div>

        <button
          class="mt-3 h-12 w-full flex items-center justify-center gap-2 rounded-2xl app-chip text-sm font-900 transition active:scale-[0.98]"
          type="button"
          @click="goBindNew"
        >
          <span class="i-mdi-credit-card-plus-outline text-5" />
          Привязать новую карту
        </button>
      </div>
    </div>
  </Teleport>
</template>
