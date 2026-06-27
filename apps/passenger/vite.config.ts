import path from 'node:path'
import { unheadVueComposablesImports } from '@unhead/vue'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import VueDevTools from 'vite-plugin-vue-devtools'
import Layouts from 'vite-plugin-vue-layouts'
import { VueRouterAutoImports } from 'vue-router/unplugin'
import VueRouter from 'vue-router/vite'

export default defineConfig({
  resolve: {
    alias: {
      '~/': `${path.resolve(__dirname, 'src')}/`,
      '@edtaxi/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },

  plugins: [
    VueRouter({
      dts: 'src/route-map.d.ts',
      importMode: 'sync',
    }),

    VueMacros({ plugins: { vue: Vue() } }),

    Layouts(),

    AutoImport({
      include: [/\.[jt]sx?$/, /\.vue$/, /\.vue\?vue/],
      imports: [
        'vue',
        '@vueuse/core',
        unheadVueComposablesImports,
        VueRouterAutoImports,
        { 'vue-router/auto': ['useLink'] },
      ],
      dts: 'src/auto-imports.d.ts',
      dirs: ['src/composables', 'src/stores'],
      vueTemplate: true,
    }),

    Components({
      extensions: ['vue'],
      include: [/\.vue$/, /\.vue\?vue/],
      dts: 'src/components.d.ts',
    }),

    Unocss(),

    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'safari-pinned-tab.svg'],
      manifest: {
        name: 'EdTaxi Passenger',
        short_name: 'EdTaxi',
        theme_color: '#07090d',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
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
    },
  },

  test: {
    include: ['test/**/*.test.ts'],
    environment: 'jsdom',
  },

})
