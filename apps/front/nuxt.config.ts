// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite';
import { SUPPORTED_LOCALES } from './config/i18n-constants';

export default defineNuxtConfig(
  {
    compatibilityDate: '2024-11-01',
    extends: ['./modules/base', './extensions/cms', './extensions/analytics', './extensions/upload-post', './extensions/crm', './extensions/affiliate', './extensions/stripe', './extensions/tokens', './extensions/tasks', './extensions/knowledge-agent'],
    devtools: { enabled: true },
    ssr: false,

    alias: {
      '@': '~/',
      '@base': '~/modules/base',
      '@cms': '~/extensions/cms',
      '@upload-post': '~/extensions/upload-post',
      '@crm': '~/extensions/crm',
      '@tasks': '~/extensions/tasks',
      '@ka': '~/extensions/knowledge-agent',
      '@affiliate': '~/extensions/affiliate',
      '@stripe': '~/extensions/stripe',
    },

    // Configure error handling
    app: {
      // Global error handling
      head: {
        titleTemplate: '%s - ' + (process.env.APP_NAME || 'Foundation'),
        meta: [
          { charset: 'utf-8' },
          { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        ],
      },
    },

    runtimeConfig: {
      public: {
        appUrl:
          process.env.FRONTEND_URL ||
          process.env.APP_URL ||
          'http://localhost:3000',
        appName: process.env.APP_NAME || 'Foundation',
        mainAppRoute: process.env.MAIN_APP_ROUTE || '/app',
        apiUrl: process.env.API_URL || 'http://localhost:3001',
        apiPrefix: process.env.API_PREFIX || '/api/v1',
        calendlyUrl: process.env.CALENDLY_URL || '',
        env: process.env.ENV || 'development',
        // Default dashboard tab id; empty = use lowest `order` (see PRD-dashboard-nav-ordering §4.2).
        defaultDashboard: '',
      },
    },

    modules: [
      '@nuxt/eslint',
      '@pinia/nuxt',
      'pinia-plugin-persistedstate',
      '@nuxtjs/i18n',
      '@nuxtjs/color-mode',
    ],

    css: ['~/assets/css/tailwind.css', 'flag-icons/css/flag-icons.min.css'],
    vite: {
      plugins: [
        tailwindcss(),
        // Workaround for @intlify/unplugin-vue-i18n 11.0.7 + Vite 8 incompatibility
        // (nuxt-modules/i18n#3953): vite:json parses i18n locale JSON before unplugin-vue-i18n
        // can transform it, causing "Failed to parse JSON file" build errors.
        // Skip vite:json for i18n locale files so unplugin-vue-i18n handles them.
        {
          name: 'i18n-json-vite8-fix',
          enforce: 'pre',
          configResolved(config) {
            const jsonPlugin = config.plugins.find((p) => p.name === 'vite:json');
            if (!jsonPlugin?.transform) return;

            const originalTransform =
              typeof jsonPlugin.transform === 'function'
                ? jsonPlugin.transform
                : jsonPlugin.transform?.handler;
            if (!originalTransform) return;

            const patchedTransform = function (this: unknown, code: string, id: string, ...args: unknown[]) {
              if (/i18n\/locales\/.*\.json$/.test(id)) return;
              return (originalTransform as Function).call(this, code, id, ...args);
            };

            if (typeof jsonPlugin.transform === 'function') {
              jsonPlugin.transform = patchedTransform as typeof jsonPlugin.transform;
            } else if (jsonPlugin.transform?.handler) {
              jsonPlugin.transform.handler = patchedTransform as typeof jsonPlugin.transform.handler;
            }
          },
        },
      ],
      server: {
        allowedHosts: ['f.vps.som-os.dev'],
      },
    },
    colorMode: {
      classSuffix: '',
    },
    i18n: {
      lazy: true,
      strategy: 'prefix_except_default',
      defaultLocale: 'es',
      langDir: 'locales',
      compilation: {
        strictMessage: false,
      },
      locales: [
        {
          code: 'es',
          iso: 'es-ES',
          name: 'Español',
          files: [
            'es/mod/common.json',
            'es/mod/app.json',
            'es/mod/auth.json',
            'es/mod/error.json',
            'es/mod/nav.json',
            'es/mod/settings.json',
            'es/mod/users.json',
            'es/mod/languages.json',
            'es/mod/translations.json',
            'es/mod/ui.json',
            'es/mod/ui/automation.json',
            'es/ext/cms.json',
            'es/ext/ka.json',
            'es/ext/upload-post.json',
            'es/ext/crm.json',
            'es/ext/affiliate.json',
            'es/ext/tasks.json',
          ],
        },
        {
          code: 'en',
          iso: 'en-US',
          name: 'English',
          files: [
            'en/mod/common.json',
            'en/mod/app.json',
            'en/mod/auth.json',
            'en/mod/error.json',
            'en/mod/nav.json',
            'en/mod/settings.json',
            'en/mod/users.json',
            'en/mod/languages.json',
            'en/mod/translations.json',
            'en/mod/ui.json',
            'en/mod/ui/automation.json',
            'en/ext/cms.json',
            'en/ext/ka.json',
            'en/ext/upload-post.json',
            'en/ext/crm.json',
            'en/ext/affiliate.json',
            'en/ext/tasks.json',
          ],
        },
      ].filter((l) => SUPPORTED_LOCALES.includes(l.code as typeof SUPPORTED_LOCALES[number])),
      vueI18n: './i18n.config.ts',
      detectBrowserLanguage: {
        useCookie: true,
        cookieKey: 'i18n_redirected',
        redirectOn: 'root',
      },
    },

    routeRules: {
      // Long-lived cache for static assets (fonts, images, logos)
      '/fonts/**': {
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      },
      '/imgs/**': {
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      },
      '/images/**': {
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      },
      '/logo.webp': {
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      },
      '/favicon.ico': {
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      },
    },

    // SPA: no SSG/prerender — pure client-side app.
    // Nitro generates a static .output/ with index.html shell + JS bundles.
    nitro: {
      preset: 'static',
    },
  },
);
