<script setup lang="ts">
// Приветственное окно приглашённого: показывается автоматически после входа по
// реферальной ссылке друга, когда бэкенд подтвердил начисление бонусов.
withDefaults(defineProps<{
  inviterName?: null | string
  open: boolean
  ownerReward: number
  reward: number
}>(), {
  inviterName: null,
})

const emit = defineEmits<{
  close: []
  share: []
}>()

function formatBonus(value: number) {
  return Math.floor(value).toLocaleString('ru-RU')
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
        class="fixed inset-0 z-[85] flex items-end bg-black/65 px-4 pb-[calc(var(--app-safe-area-bottom,0px)+1rem)] backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <section class="mx-auto max-w-sm w-full rounded-3xl bg-secondary-900 p-6 text-center text-white shadow-2xl shadow-black/30">
          <div class="mx-auto h-18 w-18 flex items-center justify-center rounded-3xl bg-main-500/16 text-main-300">
            <span class="i-mdi-gift-open text-10" aria-hidden="true" />
          </div>

          <h2 class="mt-4 text-2xl font-950 leading-tight">
            +{{ formatBonus(reward) }} бонусов!
          </h2>

          <p class="mt-2 text-sm text-slate-300 font-700 leading-6">
            Вы присоединились по ссылке друга{{ inviterName ? ` — ${inviterName}` : '' }}.
            Бонусы уже начислены на ваш счёт.
          </p>

          <div class="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-left">
            <p class="flex items-start gap-2.5 text-xs text-slate-300 font-700 leading-5">
              <span class="i-mdi-account-multiple-plus mt-0.5 shrink-0 text-4.5 text-main-300" aria-hidden="true" />
              Поделитесь своей ссылкой с друзьями — за каждого, кто присоединится,
              вы получите ещё +{{ formatBonus(ownerReward) }} бонусов.
            </p>
          </div>

          <button
            class="mt-5 h-13 w-full flex items-center justify-center gap-2 rounded-2xl bg-main-500 text-sm text-white font-950 shadow-[0_12px_30px_rgba(230,173,46,0.26)] transition active:scale-[0.98]"
            type="button"
            @click="emit('share')"
          >
            <span class="i-mdi-share-variant text-4.5" aria-hidden="true" />
            Поделиться с друзьями
          </button>

          <button
            class="mt-2 h-12 w-full rounded-2xl bg-white/8 text-sm font-900 transition active:scale-[0.98]"
            type="button"
            @click="emit('close')"
          >
            Отлично
          </button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
