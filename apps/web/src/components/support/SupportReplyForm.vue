<script setup lang="ts">
defineProps<{
  canReply: boolean
  isSending: boolean
  placeholder: string
}>()

defineEmits<{
  submit: []
}>()

const draft = defineModel<string>({ required: true })
</script>

<template>
  <form class="border-t border-white/8 bg-secondary-900/80 p-3" @submit.prevent="$emit('submit')">
    <div class="flex items-end gap-2">
      <textarea
        v-model="draft"
        aria-label="Ответ в чат поддержки"
        :disabled="!canReply"
        class="max-h-36 min-h-12 min-w-0 flex-1 resize-none border border-white/10 rounded-lg bg-white/7 px-4 py-3 text-sm outline-none transition focus:border-main-400/60 focus:bg-white/10 placeholder:text-white/35 disabled:opacity-45"
        maxlength="2000"
        name="support_reply"
        rows="1"
        :placeholder="placeholder"
        @keydown.enter.exact.prevent="$emit('submit')"
      />
      <button
        aria-label="Отправить ответ"
        :disabled="!draft.trim() || !canReply || isSending"
        class="h-12 w-12 flex shrink-0 items-center justify-center rounded-lg bg-main-500 text-white transition active:scale-[0.97] hover:bg-main-400 disabled:opacity-40"
        type="submit"
      >
        <span class="i-mdi-send text-5" aria-hidden="true" />
      </button>
    </div>
  </form>
</template>
