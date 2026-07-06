// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite';

function getI18nFiles(_langCode: string) {
  return ['dynamic-loader.ts'];
}

export default defineNuxtConfig(
  {
    compatibilityDate: '2024-11-01',
    extends: ['./modules/landing', './modules/base', './extensions/cms', './extensions/upload-post', './extensions/crm', './extensions/affiliate', './extensions/content-pipeline', './extensions/autonomous-agent', './extensions/stripe'],
    devtools: { enabled: true },
    ssr: true,

    alias: {
      '@': '~/',
      '@base': '~/modules/base',
      '@cms': '~/extensions/cms',
      '@upload-post': '~/extensions/upload-post',
      '@crm': '~/extensions/crm',
      '@affiliate': '~/extensions/affiliate',
      '@content-pipeline': '~/extensions/content-pipeline',
      '@autonomous-agent': '~/extensions/autonomous-agent',
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
        env: process.env.ENV || 'development',
      },
    },

    modules: [
      '@nuxt/image',
      '@nuxtjs/sitemap',
      'nuxt-og-image',
      '@nuxt/eslint',
      '@pinia/nuxt',
      'pinia-plugin-persistedstate',
      '@nuxtjs/i18n',
      '@nuxtjs/color-mode',
    ],

    css: ['~/assets/css/tailwind.css', 'flag-icons/css/flag-icons.min.css'],
    vite: {
      // @ts-expect-error - Incompatible vite/rollup plugin types in this environment
      plugins: [tailwindcss()],
    },
    colorMode: {
      classSuffix: '',
    },
    hooks: {
      // @ts-expect-error - i18n:registerModule hook types not aligned with @nuxtjs/i18n
      'i18n:registerModule': async function (
        register: (config: {
          langDir: string;
          locales: Array<{
            code: string;
            name: string;
            files: string[];
            flagCode: string;
          }>;
        }) => void,
      ) {
        try {
          // Fetch active languages directly from the backend during Nuxt startup
          const apiUrl = process.env.API_URL || 'http://localhost:3001';
          const apiPrefix = process.env.API_PREFIX || '/api/v1';

          // Use native fetch to get the langs from the database
          const res = await fetch(`${apiUrl}${apiPrefix}/translations/langs`);
          const langsDb = (await res.json()) as Array<{
            code: string;
            name: string;
            isActive: boolean;
            flagCode?: string;
          }>;

          // Map database languages to Nuxt i18n locales format
          const dynamicLocales = langsDb
            .filter((lang) => lang.isActive) // Guarantee we only register active ones
            .map((lang) => ({
              code: lang.code,
              name: lang.name,
              files: getI18nFiles(lang.code),
              flagCode: lang.flagCode || lang.code,
            }));

          // Only register locales from backend that are NOT already in static config
          // to avoid duplicates. Static config already has es, en as fallback.
          const staticCodes = new Set(['es', 'en']);
          const newLocales = dynamicLocales.filter(
            (lang) => !staticCodes.has(lang.code),
          );

          if (newLocales.length > 0) {
            register({
              langDir: 'locales',
              locales: newLocales,
            });
          }
        } catch (error) {
          console.warn(
            '⚠️ Failed to fetch dynamic languages from backend. Using static fallback locales [es, en].',
            error,
          );
          // Static fallback already defined in i18n.locales config
        }
      },
    },
    i18n: {
      lazy: true,
      strategy: 'prefix_except_default',
      defaultLocale: 'es',
      locales: [
        { code: 'es', iso: 'es-ES', name: 'Español', files: ['dynamic-loader.ts'] },
        { code: 'en', iso: 'en-US', name: 'English', files: ['dynamic-loader.ts'] },
      ],
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
      url: process.env.FRONTEND_URL || 'http://localhost:3000',
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
      // Public CMS routes - prerender at build time (default locale, no prefix)
      '/blog': { prerender: true },
      '/blog/**': { prerender: true },
      '/page/**': { prerender: true },
      // Public CMS routes - prerender for non-default locales (e.g., /en/blog)
      '/en/blog': { prerender: true },
      '/en/blog/**': { prerender: true },
      '/en/page/**': { prerender: true },
      '/en': { prerender: true },
      // Fallback: generate on demand if not prerendered
      '/**': { prerender: false },
    },

    sitemap: {
      sources: [
        '/api/sitemap/blog',
        '/api/sitemap/cms-pages',
        '/api/sitemap/categories',
      ],
      exclude: [
        '/app/**',
        '/admin/**',
        '/login',
        '/login-basic',
        '/register',
        '/forgot-password',
        '/password-change',
        '/401',
        '/403',
        '/404',
        '/500',
        '/503',
      ],
      autoLastmod: true,
      credits: false,
    },

    // SSG Prerender configuration
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: ['/', '/en/', '/blog', '/en/blog'],
      failOnError: false,
    },
  },

  // Robots auto-generated by @nuxtjs/sitemap
);
