// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, localizedRoutes } from './config/i18n-constants';

export default defineNuxtConfig(
  {
    compatibilityDate: '2024-11-01',
    extends: ['./modules/landing', './modules/base', './extensions/cms', './extensions/analytics', './extensions/upload-post', './extensions/crm', './extensions/affiliate', './extensions/stripe', './extensions/tokens', './extensions/tasks', './extensions/knowledge-agent'],
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
      '@landing': '~/modules/landing',
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
      '@nuxt/image',
      'nuxt-og-image',
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
            'es/base/common.json',
            'es/base/app.json',
            'es/base/auth.json',
            'es/base/error.json',
            'es/base/nav.json',
            'es/base/settings.json',
            'es/base/users.json',
            'es/base/languages.json',
            'es/base/translations.json',
            'es/base-ui.json',
            'es/base-ui/automation.json',
            'es/cms.json',
            'es/ka.json',
            'es/landing.json',
            'es/pages/common.json',
            'es/pages/blog.json',
            'es/pages/pages.json',
            'es/pages/seo.json',
            'es/pages/tags.json',
          ],
        },
        {
          code: 'en',
          iso: 'en-US',
          name: 'English',
          files: [
            'en/base/common.json',
            'en/base/app.json',
            'en/base/auth.json',
            'en/base/error.json',
            'en/base/nav.json',
            'en/base/settings.json',
            'en/base/users.json',
            'en/base/languages.json',
            'en/base/translations.json',
            'en/base-ui.json',
            'en/base-ui/automation.json',
            'en/cms.json',
            'en/ka.json',
            'en/landing.json',
            'en/pages/common.json',
            'en/pages/blog.json',
            'en/pages/pages.json',
            'en/pages/seo.json',
            'en/pages/tags.json',
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

    ogImage: {
      zeroRuntime: true,
    },

    site: {
      url: process.env.COOLIFY_URL || process.env.NUXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
      name: process.env.APP_NAME || 'Foundation',
    },

    routeRules: {
      // Admin/app routes - client-side only (auth uses localStorage, not available in SSR)
      '/app/**': { ssr: false },
      // Redirect old category URLs to new slug-based routes
      '/blog/category/**': { redirect: { to: '/blog/c/**', statusCode: 301 } },
      '/en/blog/category/**': {
        redirect: { to: '/en/blog/c/**', statusCode: 301 },
      },
      // Public CMS routes - NOT prerendered (require backend API, not available at build time)
      // Pages render client-side with empty/loading state when backend is unreachable
      '/blog/**': { prerender: false },
      '/page/**': { prerender: false },
      '/en/blog/**': { prerender: false },
      '/en/page/**': { prerender: false },
      '/en': { prerender: true },

      '/': { prerender: true },
      // ...Object.fromEntries(
      //   localizedRoutes(['/calculadoras', '/calculadoras/**']).map((path) => [
      //     path,
      //     { prerender: true },
      //   ]),
      // ),

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



      // Fallback: generate on demand if not prerendered
      '/**': { prerender: false },
    },

    // @nuxtjs/sitemap removed — sitemap now centralized in Astro apps/web
    // via @astrojs/sitemap (R-CMS-R-01). The server/api/sitemap/* sources
    // and the sitemap config block were removed.

    // SSG Prerender configuration
    preset: 'static',
    prerender: {
      crawlLinks: true,
      // Seeds generated programmatically from SUPPORTED_LOCALES.
      // crawlLinks discovers all linked sub-pages from these seeds.
      routes: localizedRoutes(['/']),
      failOnError: false,
    },
  },

  // Robots now served by Astro apps/web (robots.txt endpoint).
  // @nuxtjs/sitemap removed; sitemap centralized in Astro.
);
