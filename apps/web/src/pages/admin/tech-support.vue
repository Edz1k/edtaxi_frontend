<script setup lang="ts">
import WebPageShell from '~/components/app/WebPageShell.vue'
import { isKazakhstanPhoneComplete, toKazakhstanE164 } from '~/composables/auth/phone'
import { useAdminStore } from '~/stores/admin'
import { formatDate } from '~/utils/format'

const admin = useAdminStore()
const phone = ref('')
const name = ref('')

const canSubmit = computed(() => isKazakhstanPhoneComplete(phone.value) && !admin.isMutating)

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    layout: 'admin',
    requiredRole: ['admin', 'superadmin'],
  },
})

useHead({
  title: 'Техподдержка | Админка',
})

onMounted(() => {
  admin.loadTechSupportNumbers().catch(() => {})
})

async function submit() {
  if (!canSubmit.value)
    return

  await admin.addTechSupportNumber(toKazakhstanE164(phone.value), name.value.trim())
  phone.value = ''
  name.value = ''
}
</script>

<template>
  <WebPageShell
    embedded
    description="Управляйте номерами, которым разрешён отдельный вход в кабинет техподдержки."
    title="Техподдержка"
  >
    <form class="grid mt-6 gap-3 border border-white/10 rounded-3xl bg-white/8 p-4 backdrop-blur md:grid-cols-[minmax(200px,1fr)_minmax(160px,0.7fr)_auto] md:items-end" @submit.prevent="submit">
      <PhoneInput v-model="phone" />
      <input
        v-model="name"
        aria-label="Имя сотрудника"
        class="h-12 border border-white/10 rounded-2xl bg-white/6 px-4 text-sm text-white outline-none transition focus:border-cyan-400/50"
        placeholder="Имя (напр. Олжас)"
        type="text"
      >
      <button
        :disabled="!canSubmit"
        class="h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 text-sm text-#06142f font-950 transition active:scale-[0.98] disabled:opacity-50"
        type="submit"
      >
        <span class="i-mdi-plus text-5" />
        Добавить
      </button>
    </form>

    <div class="mt-5 overflow-hidden border border-white/10 rounded-3xl bg-white/8 backdrop-blur">
      <div class="grid-cols-[minmax(180px,1fr)_180px_120px] hidden gap-3 border-b border-white/8 px-4 py-3 text-xs text-white/42 font-900 uppercase md:grid">
        <span>Номер</span>
        <span>Добавлен</span>
        <span class="text-right">Действие</span>
      </div>

      <div v-if="admin.isLoadingTechSupportNumbers" class="px-4 py-6 text-sm text-white/50">
        Загружаем номера...
      </div>

      <div v-else-if="!admin.techSupportNumbers.length" class="px-4 py-6 text-sm text-white/50">
        Номеров техподдержки пока нет.
      </div>

      <div
        v-for="number in admin.techSupportNumbers"
        v-else
        :key="number.phone"
        class="grid gap-3 border-b border-white/6 px-4 py-4 md:grid-cols-[minmax(180px,1fr)_180px_120px] md:items-center last:border-b-0"
      >
        <!-- Второй строкой всегда номер: раньше без имени сюда падал added_by,
             и админ видел UUID того, кто добавил запись. -->
        <div class="min-w-0">
          <p class="truncate text-sm font-900">
            {{ number.name || 'Без имени' }}
          </p>
          <p class="mt-0.5 truncate text-xs text-white/42">
            {{ number.phone }}
          </p>
        </div>

        <span class="text-sm text-white/50 font-800">{{ formatDate(number.created_at) }}</span>

        <button
          :disabled="admin.isMutating"
          class="h-10 rounded-xl bg-red-500/12 px-3 text-sm text-red-300 font-900 transition active:scale-[0.98] md:justify-self-end disabled:opacity-50"
          type="button"
          @click="admin.removeTechSupportNumber(number.phone)"
        >
          Удалить
        </button>
      </div>
    </div>
  </WebPageShell>
</template>
