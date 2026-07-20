<script setup lang="ts">
const { t } = useI18n()

const legalLinks = computed(() => [
  { to: '/legal/offer', label: t('footer.offer') },
  { to: '/legal/privacy', label: t('footer.privacy') },
  { to: '/legal/refund', label: t('footer.refund') },
  { to: '/legal/requisites', label: t('footer.requisites') },
])
</script>

<template>
  <footer class="relative border-t border-white/10 px-5 py-12">
    <div class="mx-auto max-w-1180px">
      <div class="grid gap-10 md:grid-cols-4 sm:grid-cols-2">
        <div>
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-cyan-300 text-#06142f">
              <div class="i-mdi:taxi text-xl" />
            </div>
            <p class="font-900">
              {{ t('brand.name') }}
            </p>
          </div>
          <p class="mt-3 text-sm text-white/50 leading-6">
            {{ t('footer.tagline') }}
          </p>
        </div>

        <div>
          <p class="text-sm text-cyan-300 font-800">
            {{ t('footer.docsTitle') }}
          </p>
          <div class="grid mt-3 gap-2">
            <RouterLink
              v-for="link in legalLinks"
              :key="link.to"
              :to="link.to"
              class="text-sm text-white/60 transition hover:text-cyan-300"
            >
              {{ link.label }}
            </RouterLink>
          </div>
        </div>

        <div>
          <p class="text-sm text-cyan-300 font-800">
            {{ t('footer.companyTitle') }}
          </p>
          <div class="grid mt-3 gap-2 text-sm text-white/60">
            <p>{{ t('footer.companyName') }}</p>
            <p>{{ t('footer.companyJurisdiction') }}</p>
            <a href="mailto:info@telegramtaxi.kz" class="transition hover:text-cyan-300">info@telegramtaxi.kz</a>
          </div>
        </div>

        <div>
          <p class="text-sm text-cyan-300 font-800">
            {{ t('footer.paymentsTitle') }}
          </p>
          <div class="mt-3">
            <PaymentMethodBadges />
          </div>
          <p class="mt-3 text-xs text-white/50">
            {{ t('footer.paymentsNote') }}
          </p>
        </div>
      </div>

      <div class="mt-10 border-t border-white/10 pt-6 text-xs text-white/40">
        © {{ new Date().getFullYear() }} {{ t('footer.companyName') }} · {{ t('footer.rights') }}
      </div>
    </div>
  </footer>
</template>
