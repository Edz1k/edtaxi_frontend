<script setup lang="ts">
import { useRoute as useVueRoute } from 'vue-router'
import SupportChatHeader from '~/components/support/SupportChatHeader.vue'
import SupportClientPanel from '~/components/support/SupportClientPanel.vue'
import SupportMessageList from '~/components/support/SupportMessageList.vue'
import SupportReplyForm from '~/components/support/SupportReplyForm.vue'
import { useSupportSocket } from '~/composables/useSupportSocket'
import { useAuthStore } from '~/stores/auth'
import { useSupportStore } from '~/stores/support'
import { isAssignedTo } from '~/utils/support'

const route = useVueRoute()
const router = useRouter()
const support = useSupportStore()
const auth = useAuthStore()
const socket = useSupportSocket()

const roomId = computed(() => (route.params as Record<string, string>).id)
const draft = ref('')
const currentUserId = computed(() => auth.currentUser?.id)

const canReply = computed(() => {
  const status = support.currentRoom?.status
  return isAssignedTo(support.currentRoom, currentUserId.value)
    && status !== 'closed'
    && status !== 'pending_close'
})

const replyPlaceholder = computed(() => {
  const room = support.currentRoom
  if (room?.status === 'closed')
    return 'Чат закрыт'
  if (room?.status === 'pending_close')
    return 'Ждём подтверждение пользователя'
  if (isAssignedTo(room, currentUserId.value))
    return 'Написать ответ...'
  return room?.agent_id ? 'Взято другим агентом' : 'Возьмите обращение в работу'
})

definePage({
  meta: {
    authRedirect: '/support/login',
    requiresAuth: true,
    requiredRole: ['admin', 'superadmin', 'tech_support'],
  },
})

useHead({
  title: 'Чат поддержки | Telegram Taxi',
})

async function openRoom(id: string) {
  const room = await support.loadRoom(id).catch(() => null)
  if (!room) {
    await router.push('/support')
    return
  }
  await support.loadMessages(id).catch(() => {})
}

async function claim() {
  try {
    await support.claimRoom(roomId.value)
  }
  catch {}
}

async function closeAsResolved() {
  const room = support.currentRoom
  if (!room || support.isMutating)
    return
  try {
    await support.closeRoom(room)
    await support.loadMessages(room.id).catch(() => {})
  }
  catch {}
}

async function send() {
  const content = draft.value.trim()
  if (!content || support.isSending || !canReply.value)
    return
  try {
    await support.sendMessage(roomId.value, content)
    draft.value = ''
  }
  catch {}
}

onMounted(async () => {
  await openRoom(roomId.value)
  socket.connect()
})

// Компонент маршрута переиспользуется при переходе между обращениями
// (меняется только :id, onMounted не срабатывает повторно) — иначе на экране
// осталась бы переписка предыдущей комнаты до перезагрузки страницы.
watch(roomId, (id, prev) => {
  if (id && id !== prev)
    openRoom(id)
})
</script>

<template>
  <main class="h-screen flex flex-col bg-secondary-900 text-white">
    <SupportChatHeader
      :room="support.currentRoom"
      :message-count="support.messages.length"
      :is-mutating="support.isMutating"
      :error-message="support.errorMessage"
      :current-user-id="currentUserId"
      @claim="claim"
      @close="closeAsResolved"
    />

    <section class="min-h-0 flex-1 px-4 py-4">
      <div class="grid mx-auto h-full max-w-6xl gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <SupportClientPanel
          :room="support.currentRoom"
          :message-count="support.messages.length"
          :current-user-id="currentUserId"
        />

        <div class="min-h-0 flex flex-col overflow-hidden border border-white/10 rounded-lg bg-white/5">
          <SupportMessageList
            :messages="support.messages"
            :is-loading="support.isLoadingMessages"
            :current-user-id="currentUserId"
          />
          <SupportReplyForm
            v-model="draft"
            :can-reply="canReply"
            :is-sending="support.isSending"
            :placeholder="replyPlaceholder"
            @submit="send"
          />
        </div>
      </div>
    </section>
  </main>
</template>
