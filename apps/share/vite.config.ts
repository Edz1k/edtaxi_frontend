import path from 'node:path'
import { unheadVueComposablesImports } from '@unhead/vue'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import { defineConfig } from 'vite'
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
      extensions: ['.vue'],
      dts: 'src/route-map.d.ts',
    }),

    VueMacros({
      plugins: {
        vue: Vue(),
      },
    }),

    Layouts(),

    AutoImport({
      imports: ['vue', '@vueuse/core', unheadVueComposablesImports, VueRouterAutoImports],
      dts: 'src/auto-imports.d.ts',
      dirs: ['src/composables', 'src/stores'],
      vueTemplate: true,
    }),

    Components({
      dts: 'src/components.d.ts',
    }),

    Unocss(),
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
})
