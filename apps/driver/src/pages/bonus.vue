<script setup lang="ts">
import type { BonusOverview, BonusPromotion } from '@edtaxi/shared/types/bonus'
import { getBonusOverview, getMyPromotions, joinPromotion, redeemReferralCode } from '@edtaxi/shared/api/bonus'
import { openExternalLink } from '@edtaxi/shared/composables/auth/telegram'
import { buildReferralShareUrl } from '@edtaxi/shared/composables/telegram/referral'
import { useAutoRefresh } from '@edtaxi/shared/composables/useAutoRefresh'
import { mediaUrl } from '~/api/client'
import { showErrorToast } from '~/api/errors'
import { TG_BOT_USERNAME } from '~/constants/telegram'

const router = useRouter()

const overview = ref<BonusOverview | null>(null)
const promotions = ref<BonusPromotion[]>([])
const isLoading = ref(true)

const friendCode = ref('')
const isRedeeming = ref(false)
const redeemSuccess = ref('')

definePage({
  meta: {
    authRedirect: '/login',
    requiresAuth: true,
    requiredRole: 'driver',
  },
})

useHead({
  title: 'Бонусы | EdTaxi',
})

onMounted(load)

// Баланс и прогресс акций обновляются сами при возврате на экран — как у
// пассажира: начисления за заказы видны без ручной перезагрузки.
useAutoRefresh(async () => {
  const [me, promos] = await Promise.all([getBonusOverview(), getMyPromotions()])
  overview.value = me
  promotions.value = promos.promotions
})

async function load() {
  try {
    const [me, promos] = await Promise.all([getBonusOverview(), getMyPromotions()])
    overview.value = me
    promotions.value = promos.promotions
  }
  catch (error) {
    showErrorToast(error, 'Не удалось загрузить бонусы.')
  }
  finally {
    isLoading.value = false
  }
}

function formatBonus(value: number) {
  return Math.floor(value).toLocaleString('ru-RU')
}

// Лимит приглашений фиксирован на бэке (3): invited + left в сумме дают его.
const inviteLimit = computed(() =>
  overview.value ? overview.value.invited_count + overview.value.invites_left : 3,
)

const { copied, copy } = useClipboard({ copiedDuring: 2000 })

function copyCode() {
  if (overview.value)
    copy(overview.value.referral_code)
}

// «Поделиться» шлёт диплинк на бота: друг открывает ссылку, мини-апп
// запускается сам, и после входа бонусы начисляются автоматически — вводить
// код руками больше не нужно.
function shareCode() {
  if (!overview.value)
    return

  const text = `Зарабатывай с EdTaxi! Открой ссылку и войди — получишь +${formatBonus(overview.value.invitee_reward)} бонусов на счёт 🚕`
  openExternalLink(buildReferralShareUrl(TG_BOT_USERNAME, overview.value.referral_code, text))
}

async function redeem() {
  const code = friendCode.value.trim().toUpperCase()
  if (!code || isRedeeming.value)
    return

  isRedeeming.value = true
  try {
    await redeemReferralCode(code)
    // Сумму фиксируем до перезагрузки обзора — после неё форма скрывается.
    redeemSuccess.value = `+${formatBonus(overview.value?.invitee_reward ?? 0)} бонусов начислено`
    friendCode.value = ''
    await load()
  }
  catch (error) {
    showErrorToast(error, 'Не удалось применить код.')
  }
  finally {
    isRedeeming.value = false
  }
}

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(value))
}

function promoProgress(promo: BonusPromotion) {
  if (promo.target_trips <= 0)
    return 0
  return Math.min(100, Math.round((promo.my_trips / promo.target_trips) * 100))
}

// Парковые акции — opt-in: прогресс считается после кнопки «Участвовать».
const joiningPromoId = ref('')

async function joinPromo(promo: BonusPromotion) {
  if (joiningPromoId.value)
    return
  joiningPromoId.value = promo.id
  try {
    await joinPromotion(promo.id)
    const promos = await getMyPromotions()
    promotions.value = promos.promotions
  }
  catch (error) {
    showErrorToast(error, 'Не удалось вступить в акцию.')
  }
  finally {
    joiningPromoId.value = ''
  }
}
</script>

<template>
  <main class="tg-safe-x h-full overflow-y-auto bg-secondary-900 pb-[calc(var(--app-safe-area-bottom)+1.5rem)] pt-[calc(var(--app-safe-area-top)+0.75rem)] text-white">
    <section class="mx-auto max-w-sm">
      <!-- Header -->
      <div class="mb-4 flex items-center gap-2">
        <button
          aria-label="Назад"
          class="h-9 w-9 flex shrink-0 items-center justify-center rounded-full bg-white/8 transition active:scale-95"
          type="button"
          @click="router.back()"
        >
          <span class="i-mdi-arrow-left text-5" />
        </button>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-900">
            Бонусы
          </p>
          <p class="text-xs text-slate-400 font-700">
            Программа лояльности EdTaxi
          </p>
        </div>
      </div>

      <div v-if="isLoading" class="space-y-3">
        <div class="h-32 animate-pulse rounded-3xl bg-white/6" />
        <div class="h-44 animate-pulse rounded-3xl bg-white/6" />
        <div class="h-24 animate-pulse rounded-3xl bg-white/6" />
      </div>

      <template v-else-if="overview">
        <!-- Баланс -->
        <section class="border border-main-500/20 rounded-3xl bg-white/6 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <p class="text-xs text-slate-400 font-800 uppercase">
            Баланс
          </p>
          <h1 class="mt-2 text-4xl text-main-200 font-950">
            {{ formatBonus(overview.balance) }} бонусов
          </h1>
          <p class="mt-1 text-sm text-slate-400">
            Бонусы платформы — не тенге
          </p>
          <p class="mt-3 rounded-2xl bg-white/6 px-4 py-2.5 text-xs text-main-100 font-800">
            <span class="i-mdi-star-four-points mr-1 inline-block align-middle text-3.5 text-main-300" />
            +{{ formatBonus(overview.milestone_bonus) }} бонусов за каждые {{ overview.milestone_every }} заказов
          </p>
        </section>

        <!-- Мой код -->
        <section class="mt-6">
          <h2 class="text-xs text-slate-400 font-800 uppercase">
            Мой код
          </h2>
          <div class="mt-3 rounded-3xl bg-white/5 p-4">
            <p class="select-all rounded-2xl bg-secondary-950/70 py-3 text-center text-2xl font-950 tracking-[0.18em] font-mono">
              {{ overview.referral_code }}
            </p>

            <div class="grid grid-cols-2 mt-3 gap-2">
              <button
                class="h-12 flex items-center justify-center gap-1.5 rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98]"
                type="button"
                @click="shareCode"
              >
                <span class="i-mdi-share-variant text-4.5" />
                Поделиться
              </button>
              <button
                class="h-12 flex items-center justify-center gap-1.5 rounded-2xl bg-white/8 text-sm font-900 transition active:scale-[0.98]"
                type="button"
                @click="copyCode"
              >
                <span :class="copied ? 'i-mdi-check text-emerald-300' : 'i-mdi-content-copy'" class="text-4.5" />
                {{ copied ? 'Скопировано' : 'Скопировать код' }}
              </button>
            </div>

            <p class="mt-3 text-xs text-slate-500 leading-4">
              Приглашено {{ overview.invited_count }} из {{ inviteLimit }} · за каждого друга +{{ formatBonus(overview.owner_reward) }} бонусов
            </p>
          </div>
        </section>

        <!-- Код применён — благодарность вместо формы -->
        <p v-if="redeemSuccess" class="mt-6 rounded-2xl bg-emerald-500/12 px-4 py-3 text-sm text-emerald-300 font-800">
          <span class="i-mdi-check-circle mr-1 inline-block align-middle text-4" />
          {{ redeemSuccess }}
        </p>

        <!-- Ввести код друга -->
        <section v-if="!overview.code_redeemed" class="mt-6">
          <h2 class="text-xs text-slate-400 font-800 uppercase">
            Ввести код друга
          </h2>
          <form class="grid grid-cols-[1fr_auto] mt-3 gap-2" @submit.prevent="redeem">
            <input
              v-model="friendCode"
              aria-label="Код друга"
              class="h-13 min-w-0 border border-white/10 rounded-2xl bg-white/6 px-4 text-sm uppercase outline-none transition focus:border-main-400/60"
              maxlength="12"
              name="friend_code"
              placeholder="Например, ED7X4K"
            >
            <button
              :disabled="!friendCode.trim() || isRedeeming"
              class="h-13 rounded-2xl bg-main-500 px-5 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
              type="submit"
            >
              {{ isRedeeming ? '...' : 'Применить' }}
            </button>
          </form>
          <p class="mt-2 text-xs text-slate-500">
            За код друга вы получите +{{ formatBonus(overview.invitee_reward) }} бонусов
          </p>
        </section>

        <!-- Акции -->
        <section class="mt-6">
          <h2 class="text-xs text-slate-400 font-800 uppercase">
            Акции
          </h2>

          <p v-if="!promotions.length" class="mt-3 rounded-3xl bg-white/5 p-6 text-center text-sm text-slate-400">
            Активных акций пока нет — загляните позже.
          </p>

          <div v-else class="mt-3 space-y-3">
            <article v-for="promo in promotions" :key="promo.id" class="rounded-3xl bg-white/5 p-4">
              <!-- Баннер акции (может отсутствовать) -->
              <img
                v-if="promo.image_url"
                :alt="promo.title"
                class="mb-3 max-h-40 w-full rounded-2xl object-cover"
                :src="mediaUrl(promo.image_url)"
              >
              <div class="flex items-start justify-between gap-3">
                <p class="min-w-0 text-base font-950">
                  {{ promo.title }}
                </p>
                <span class="shrink-0 rounded-full bg-main-500/14 px-3 py-1.5 text-xs text-main-200 font-900">
                  +{{ formatBonus(promo.reward) }} бонусов
                </span>
              </div>
              <p v-if="promo.description" class="mt-1 text-xs text-slate-400 leading-4">
                {{ promo.description }}
              </p>
              <p v-if="promo.message" class="mt-1 text-xs text-slate-300 leading-4">
                {{ promo.message }}
              </p>

              <!-- Парковая акция без вступления: прогресс начнётся после
                   «Участвовать». Остальные — прогресс-бар как раньше. -->
              <button
                v-if="promo.joined === false"
                :disabled="joiningPromoId === promo.id"
                class="mt-3 h-11 w-full rounded-2xl bg-main-500 text-sm font-950 transition active:scale-[0.98] disabled:opacity-60"
                type="button"
                @click="joinPromo(promo)"
              >
                {{ joiningPromoId === promo.id ? 'Подключаем...' : 'Участвовать' }}
              </button>
              <template v-else>
                <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div class="h-full rounded-full bg-main-400" :style="{ width: `${promoProgress(promo)}%` }" />
                </div>
                <div class="mt-2 flex items-center justify-between text-xs font-700">
                  <span class="text-slate-400">{{ promo.my_trips }} / {{ promo.target_trips }} заказов</span>
                  <span class="text-slate-500">до {{ formatDeadline(promo.ends_at) }}</span>
                </div>
                <p class="mt-1.5 text-[11px] text-slate-500 leading-4">
                  {{ promo.award_mode === 'manual'
                    ? 'Награду получите после завершения акции — её отправит организатор.'
                    : 'Бонусы начислятся автоматически при выполнении условия.' }}
                </p>
              </template>
            </article>
          </div>
        </section>
      </template>

      <p v-else class="rounded-3xl bg-white/5 p-6 text-center text-sm text-slate-400">
        Не удалось загрузить бонусы. Потяните вниз или зайдите позже.
      </p>
    </section>
  </main>
</template>
