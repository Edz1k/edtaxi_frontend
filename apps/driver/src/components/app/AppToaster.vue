<script setup lang="ts">
import {
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from 'reka-ui'
import { useToast } from '~/composables/useToast'

const { removeToast, toasts } = useToast()

const toastStyles = {
  error: {
    icon: 'i-mdi-alert-circle',
    iconClass: 'bg-red-500/16 text-red-300',
    rootClass: 'border-red-400/20 bg-[#160f14]/94',
  },
  info: {
    icon: 'i-mdi-information',
    iconClass: 'bg-main-500/16 text-main-300',
    rootClass: 'border-main-400/20 bg-secondary-900/94',
  },
  success: {
    icon: 'i-mdi-check-circle',
    iconClass: 'bg-emerald-500/16 text-emerald-300',
    rootClass: 'border-emerald-400/20 bg-[#0b1512]/94',
  },
  warning: {
    icon: 'i-mdi-alert',
    iconClass: 'bg-amber-500/16 text-amber-300',
    rootClass: 'border-amber-400/20 bg-[#171309]/94',
  },
}
</script>

<template>
  <ToastProvider :duration="4200" swipe-direction="right">
    <ToastRoot
      v-for="toast in toasts"
      :key="toast.id"
      class="data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in grid grid-cols-[44px_1fr_auto] max-w-sm w-[calc(100vw-2rem)] items-start gap-3 border rounded-3xl p-3 text-white shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl"
      :class="toastStyles[toast.kind].rootClass"
      @update:open="(open) => !open && removeToast(toast.id)"
    >
      <div
        class="h-11 w-11 flex shrink-0 items-center justify-center rounded-2xl"
        :class="toastStyles[toast.kind].iconClass"
      >
        <span class="text-6" :class="toastStyles[toast.kind].icon" />
      </div>

      <div class="min-w-0 pt-0.5">
        <ToastTitle class="text-sm font-950">
          {{ toast.title }}
        </ToastTitle>

        <ToastDescription
          v-if="toast.description"
          class="mt-1 text-xs text-slate-300 font-700 leading-5"
        >
          {{ toast.description }}
        </ToastDescription>
      </div>

      <ToastClose class="h-9 w-9 flex items-center justify-center rounded-full bg-white/8 text-slate-300 transition active:scale-[0.95]">
        <span class="i-mdi-close text-5" />
      </ToastClose>
    </ToastRoot>

    <ToastViewport class="tg-safe-x fixed right-0 top-[calc(var(--app-safe-area-top)+1rem)] z-[80] flex flex-col items-end gap-2 outline-none" />
  </ToastProvider>
</template>
