import path from 'node:path'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import Shiki from '@shikijs/markdown-it'
import { unheadVueComposablesImports } from '@unhead/vue'
import Vue from '@vitejs/plugin-vue'
import LinkAttributes from 'markdown-it-link-attributes'
import Unocss from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import VueDevTools from 'vite-plugin-vue-devtools'
import Layouts from 'vite-plugin-vue-layouts'
import { defineConfig } from 'vitest/config'
import { VueRouterAutoImports } from 'vue-router/unplugin'
import VueRouter from 'vue-router/vite'

const EXTERNAL_LINK_RE = /^https?:\/\//

export default defineConfig({
  resolve: {
    alias: {
      '~/': `${path.resolve(__dirname, 'src')}/`,
      '@edtaxi/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },

  plugins: [
    VueRouter({
      extensions: ['.vue', '.md'],
      dts: 'src/route-map.d.ts',
    }),

    VueMacros({
      plugins: {
        vue: Vue({
          include: [/\.vue$/, /\.md$/],
        }),
      },
    }),

    Layouts(),

    AutoImport({
      include: [/\.[jt]sx?$/, /\.vue$/, /\.vue\?vue/, /\.md$/],
      imports: [
        'vue',
        '@vueuse/core',
        unheadVueComposablesImports,
        VueRouterAutoImports,
        { 'vue-router/auto': ['useLink'] },
        { 'vue-i18n': ['useI18n'] },
      ],
      dts: 'src/auto-imports.d.ts',
      dirs: ['src/composables', 'src/stores'],
      vueTemplate: true,
    }),

    Components({
      extensions: ['vue', 'md'],
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      dts: 'src/components.d.ts',
    }),

    Unocss(),

    Markdown({
      wrapperClasses: 'prose prose-sm m-auto text-left',
      headEnabled: true,
      async markdownItSetup(md) {
        md.use(LinkAttributes, {
          matcher: (link: string) => EXTERNAL_LINK_RE.test(link),
          attrs: { target: '_blank', rel: 'noopener' },
        })
        md.use(await Shiki({
          defaultColor: false,
          themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
        }))
      },
    }),

    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      include: [path.resolve(__dirname, 'locales/**')],
    }),

    VueDevTools(),
  ],

  server: {
    proxy: {
      '/api': {
        target: 'https://api.telegramtaxi.kz',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: 'localhost',
      },
      '/ws': {
        target: 'wss://ws.telegramtaxi.kz',
        changeOrigin: true,
        secure: true,
        ws: true,
      },
    },
  },

  test: {
    include: ['test/**/*.test.ts'],
    environment: 'jsdom',
  },
})
