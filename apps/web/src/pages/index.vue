<script setup lang="ts">
const contactEmail = 'info@telegramtaxi.kz'
const telegramLink = 'https://t.me/telegramtaxi'

const { t } = useI18n()

const roadmapItems = computed(() => [
  { phase: t('roadmap.phase1'), title: t('roadmap.phase1Title') },
  { phase: t('roadmap.phase2'), title: t('roadmap.phase2Title') },
  { phase: t('roadmap.phase3'), title: t('roadmap.phase3Title') },
  { phase: t('roadmap.phase4'), title: t('roadmap.phase4Title') },
])

const fleetItems = computed(() => [
  { label: t('fleets.managementLabel'), value: t('fleets.managementValue') },
  { label: t('fleets.statsLabel'), value: t('fleets.statsValue') },
  { label: t('fleets.brandLabel'), value: t('fleets.brandValue') },
])
</script>

<template>
  <main class="min-h-screen overflow-x-hidden bg-#06142f text-white">
    <!-- Background -->
    <div class="pointer-events-none fixed inset-0">
      <div class="absolute left-[-25%] top-[-10%] h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl md:left-[-10%]" />
      <div class="absolute right-[-25%] top-40 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl md:right-[-10%]" />
      <div class="bg-size-[64px_64px] absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] opacity-15" />
    </div>

    <!-- Navbar -->
    <NavigationComponent />

    <!-- Hero -->
    <section id="hero" class="relative min-h-screen flex scroll-mt-28 items-center px-5 pb-16 pt-30 md:pt-36">
      <div class="grid mx-auto max-w-1180px items-center gap-12 lg:grid-cols-2">
        <div>
          <div class="mb-6 inline-flex items-center gap-2 border border-cyan-300/30 rounded-full bg-cyan-300/10 px-4 py-2 text-xs text-cyan-100 md:text-sm">
            <div class="i-mdi-lan-connect" />
            {{ t('hero.badge') }}
          </div>

          <h1 class="max-w-650px text-5xl font-950 leading-none md:text-7xl">
            {{ t('hero.title') }}
          </h1>

          <p class="mt-6 max-w-560px text-base text-white/70 leading-7 md:text-lg md:leading-8">
            {{ t('hero.description') }}
          </p>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#platform"
              class="inline-flex justify-center rounded-full bg-cyan-300 px-7 py-4 text-#06142f font-900 shadow-cyan-400/25 shadow-xl transition hover:bg-cyan-200"
            >
              {{ t('hero.primary') }}
            </a>

            <a
              href="#token"
              class="inline-flex justify-center border border-white/20 rounded-full bg-white/8 px-7 py-4 text-white font-800 backdrop-blur transition hover:bg-white/12"
            >
              {{ t('hero.secondary') }}
            </a>
          </div>
        </div>

        <!-- Right card -->
        <div class="relative">
          <div class="absolute inset-0 rounded-50px bg-cyan-300/20 blur-3xl" />

          <div class="relative border border-cyan-200/25 rounded-36px bg-white/10 p-3 shadow-2xl backdrop-blur-xl md:rounded-42px md:p-5">
            <div class="border border-white/10 rounded-30px bg-#0a2148 p-5 md:rounded-34px md:p-7">
              <div class="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p class="text-sm text-white/50">
                    {{ t('hero.cardNetwork') }}
                  </p>
                  <h2 class="text-2xl font-900">
                    {{ t('hero.cardTitle') }}
                  </h2>
                </div>

                <div class="h-12 w-12 flex shrink-0 items-center justify-center rounded-2xl bg-cyan-300 text-#06142f md:h-13 md:w-13">
                  <div class="i-mdi-bus text-2xl" />
                </div>
              </div>

              <div class="relative h-230px overflow-hidden border border-white/10 rounded-3xl bg-#102b5c md:h-260px">
                <div class="absolute left-8 top-8 h-24 w-24 border border-cyan-300/80 rounded-full bg-cyan-300/10" />
                <div class="absolute right-8 top-18 h-22 w-22 border border-cyan-300/70 rounded-full bg-cyan-300/10" />
                <div class="absolute bottom-8 right-14 h-28 w-28 border border-cyan-300/70 rounded-full bg-cyan-300/10" />

                <div class="absolute left-18 top-34 h-1 w-48 bg-cyan-300/60 md:left-22 md:w-58" />

                <div class="absolute left-5 top-30 border border-white/15 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur md:left-9">
                  <p class="text-xs text-white/60">
                    {{ t('hero.passengersLabel') }}
                  </p>
                  <p class="font-900">
                    {{ t('hero.passengersValue') }}
                  </p>
                </div>

                <div class="absolute right-5 top-16 border border-white/15 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur md:right-8">
                  <p class="text-xs text-white/60">
                    {{ t('hero.driversLabel') }}
                  </p>
                  <p class="font-900">
                    {{ t('hero.driversValue') }}
                  </p>
                </div>

                <div class="absolute left-1/2 top-1/2 h-18 w-18 flex items-center justify-center rounded-full bg-white text-cyan-500 shadow-xl md:h-20 md:w-20 -translate-x-1/2 -translate-y-1/2">
                  <div class="i-mdi-send text-3xl" />
                </div>
              </div>

              <div class="grid grid-cols-2 mt-5 gap-3 md:gap-4">
                <div class="border border-white/10 rounded-2xl bg-white/8 p-4">
                  <p class="text-xs text-white/50">
                    {{ t('hero.marketLabel') }}
                  </p>
                  <p class="text-lg font-900">
                    {{ t('hero.marketValue') }}
                  </p>
                </div>

                <div class="border border-white/10 rounded-2xl bg-white/8 p-4">
                  <p class="text-xs text-white/50">
                    {{ t('hero.tokenLabel') }}
                  </p>
                  <p class="text-lg font-900">
                    {{ t('hero.tokenValue') }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Platform -->
    <section id="platform" class="relative scroll-mt-28 px-5 py-20 md:py-28">
      <div class="mx-auto max-w-1180px">
        <div class="rounded-4xl border border-white/10 bg-white/6 p-6 backdrop-blur md:p-10">
          <p class="text-sm text-cyan-300 font-800">
            {{ t('platform.eyebrow') }}
          </p>

          <h2 class="mt-3 text-3xl font-900 md:text-4xl">
            {{ t('platform.title') }}
          </h2>

          <p class="mt-4 max-w-760px text-white/60 leading-8">
            {{ t('platform.description') }}
          </p>
        </div>
      </div>
    </section>

    <!-- Apps -->
    <section id="apps" class="relative scroll-mt-28 px-5 py-20 md:py-28">
      <div class="mx-auto max-w-1180px">
        <div class="mb-8">
          <p class="text-sm text-cyan-300 font-800">
            {{ t('apps.eyebrow') }}
          </p>
          <h2 class="mt-3 text-3xl font-900 md:text-4xl">
            {{ t('apps.title') }}
          </h2>
        </div>

        <div class="grid gap-5 md:grid-cols-2">
          <div class="rounded-4xl border border-white/10 bg-white/8 p-7 backdrop-blur transition hover:border-cyan-300/30 md:p-8">
            <div class="h-14 w-14 flex items-center justify-center rounded-2xl bg-cyan-300/10">
              <div class="i-mdi-account-circle text-4xl text-cyan-300" />
            </div>

            <h3 class="mt-6 text-2xl font-900">
              {{ t('apps.passengerTitle') }}
            </h3>

            <p class="mt-4 text-white/60 leading-7">
              {{ t('apps.passengerText') }}
            </p>
          </div>

          <div class="rounded-4xl border border-white/10 bg-white/8 p-7 backdrop-blur transition hover:border-cyan-300/30 md:p-8">
            <div class="h-14 w-14 flex items-center justify-center rounded-2xl bg-cyan-300/10">
              <div class="i-mdi-car text-4xl text-cyan-300" />
            </div>

            <h3 class="mt-6 text-2xl font-900">
              {{ t('apps.driverTitle') }}
            </h3>

            <p class="mt-4 text-white/60 leading-7">
              {{ t('apps.driverText') }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Token -->
    <section id="token" class="relative scroll-mt-28 px-5 py-20 md:py-28">
      <div class="rounded-4xl mx-auto max-w-1180px border border-cyan-300/20 bg-cyan-300/8 p-7 backdrop-blur md:p-10">
        <p class="text-cyan-300 font-800">
          {{ t('token.eyebrow') }}
        </p>

        <h2 class="mt-3 text-3xl font-900 md:text-4xl">
          {{ t('token.title') }}
        </h2>

        <p class="mt-4 max-w-760px text-white/60 leading-8">
          {{ t('token.description') }}
        </p>
      </div>
    </section>

    <!-- Fleets -->
    <section id="fleets" class="relative scroll-mt-28 px-5 py-20 md:py-28">
      <div class="mx-auto max-w-1180px">
        <p class="text-sm text-cyan-300 font-800">
          {{ t('fleets.eyebrow') }}
        </p>

        <h2 class="mt-3 text-3xl font-900 md:text-4xl">
          {{ t('fleets.title') }}
        </h2>

        <div class="mt-6 border border-white/10 rounded-3xl bg-white/6 p-6 backdrop-blur">
          <p class="text-white/60 leading-7">
            {{ t('fleets.description') }}
          </p>

          <div class="grid mt-6 gap-4 md:grid-cols-3">
            <div
              v-for="item in fleetItems"
              :key="item.label"
              class="border border-white/10 rounded-2xl bg-white/8 p-4"
            >
              <p class="text-sm text-cyan-300">
                {{ item.label }}
              </p>
              <b class="mt-2 block">{{ item.value }}</b>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Investment -->
    <section id="investment" class="relative scroll-mt-28 px-5 py-20 md:py-28">
      <div class="mx-auto max-w-1180px">
        <p class="text-sm text-cyan-300 font-800">
          {{ t('investment.eyebrow') }}
        </p>

        <h2 class="mt-3 text-3xl font-900 md:text-4xl">
          {{ t('investment.title') }}
        </h2>

        <div class="mt-6 border border-white/10 rounded-3xl bg-white/6 p-6 backdrop-blur">
          <p class="text-white/60 leading-7">
            {{ t('investment.description') }}
          </p>

          <div class="grid mt-6 gap-4 md:grid-cols-2">
            <div class="border border-white/10 rounded-2xl bg-white/8 p-4">
              <p class="text-sm text-cyan-300">
                {{ t('investment.issuerLabel') }}
              </p>
              <b class="mt-2 block">{{ t('investment.issuerValue') }}</b>
            </div>

            <div class="border border-white/10 rounded-2xl bg-white/8 p-4">
              <p class="text-sm text-cyan-300">
                {{ t('investment.jurisdictionLabel') }}
              </p>
              <b class="mt-2 block">{{ t('investment.jurisdictionValue') }}</b>
            </div>
          </div>

          <div class="mt-6 text-white/60">
            <p class="text-sm font-800">
              {{ t('investment.docsTitle') }}
            </p>
            <ul class="ml-5 mt-3 list-disc text-white/60">
              <li>{{ t('investment.docIncorporation') }}</li>
              <li>{{ t('investment.docWhitePaper') }}</li>
              <li>{{ t('investment.docPresentation') }}</li>
            </ul>

            <p class="mt-4 text-xs text-white/50">
              {{ t('investment.note') }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Roadmap -->
    <section id="roadmap" class="relative scroll-mt-28 px-5 py-20 md:py-28">
      <div class="mx-auto max-w-1180px">
        <p class="text-sm text-cyan-300 font-800">
          {{ t('roadmap.eyebrow') }}
        </p>

        <h2 class="mt-3 text-3xl font-900 md:text-4xl">
          {{ t('roadmap.title') }}
        </h2>

        <div class="grid mt-8 gap-4 lg:grid-cols-4 sm:grid-cols-2">
          <div
            v-for="item in roadmapItems"
            :key="item.phase"
            class="border border-white/10 rounded-3xl bg-white/8 p-6 backdrop-blur"
          >
            <p class="text-sm text-cyan-300">
              {{ item.phase }}
            </p>
            <b class="mt-2 block text-xl">{{ item.title }}</b>
          </div>
        </div>
      </div>
    </section>

    <!-- Contact -->
    <section id="contact" class="relative scroll-mt-28 px-5 pb-12 pt-20 md:pb-16 md:pt-28">
      <div class="mx-auto max-w-7xl">
        <div class="border border-white/10 rounded-3xl bg-white/6 p-6">
          <h2 class="mb-2 text-3xl font-900">
            {{ t('contact.title') }}
          </h2>
          <p class="mb-6 text-white/60 leading-7">
            {{ t('contact.description') }}
          </p>

          <div class="grid gap-3">
            <a href="https://telegramtaxi.kz" target="_blank" rel="noreferrer" class="inline-flex items-center gap-3 border border-white/10 rounded-lg bg-white/8 p-3 hover:bg-white/12">
              <div class="i-mdi-web text-xl text-cyan-300" />
              <div>
                <div class="text-sm text-white/50">{{ t('contact.websiteLabel') }}</div>
                <div class="font-800">{{ t('contact.websiteValue') }}</div>
              </div>
            </a>

            <a :href="`mailto:${contactEmail}`" class="inline-flex items-center gap-3 border border-white/10 rounded-lg bg-white/8 p-3 hover:bg-white/12">
              <div class="i-mdi-email-outline text-xl text-cyan-300" />
              <div>
                <div class="text-sm text-white/50">{{ t('contact.emailLabel') }}</div>
                <div class="font-800">{{ contactEmail }}</div>
              </div>
            </a>

            <a :href="telegramLink" target="_blank" rel="noreferrer" class="inline-flex items-center gap-3 border border-white/10 rounded-lg bg-white/8 p-3 hover:bg-white/12">
              <div class="i-mdi-telegram text-xl text-cyan-300" />
              <div>
                <div class="text-sm text-white/50">{{ t('contact.telegramLabel') }}</div>
                <div class="font-800">{{ t('contact.telegramValue') }}</div>
              </div>
            </a>
          </div>

          <p class="mt-6 text-xs text-white/50">
            {{ t('contact.note') }}
          </p>
        </div>
      </div>
    </section>
  </main>
</template>
