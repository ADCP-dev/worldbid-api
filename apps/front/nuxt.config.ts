// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

function getI18nFiles(langCode: string) {
  return ['dynamic-loader.ts'];
}

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  extends: ['./modules/landing', './modules/base', './modules/cms'],
  devtools: { enabled: true },
  ssr: false,

  alias: {
    '@': '~/',
    '@base': '~/modules/base',
    '@cms': '~/modules/cms',
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
      appName: process.env.APP_NAME || 'Foundation',
      mainAppRoute: process.env.MAIN_APP_ROUTE || '/app',
      apiUrl: process.env.API_URL || 'http://localhost:3001',
      apiPrefix: process.env.API_PREFIX || '/api/v1',
      env: process.env.ENV || 'development',
    },
  },

  modules: [
    '@nuxt/image',
    '@nuxt/fonts',
    '@nuxt/eslint',
    '@nuxt/test-utils',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate',
    '@nuxtjs/i18n',
    '@nuxtjs/sitemap',
    '@nuxtjs/color-mode',
    '@nuxtjs/robots',
    'vue-sonner/nuxt',
  ],
  css: ['~/assets/css/tailwind.css', 'flag-icons/css/flag-icons.min.css'],
  vite: {
    // @ts-ignore - Incompatible vite/rollup plugin types in this environment
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

        // Fallback to static if backend is unreachable during build
        const localesToRegister =
          dynamicLocales.length > 0
            ? dynamicLocales
            : [
                {
                  code: 'es',
                  name: 'Español',
                  files: getI18nFiles('es'),
                  flagCode: 'es',
                },
                {
                  code: 'en',
                  name: 'English',
                  files: getI18nFiles('en'),
                  flagCode: 'gb',
                },
              ];

        register({
          langDir: path.resolve(process.cwd(), 'locales'),
          locales: localesToRegister,
        });
      } catch (error) {
        console.warn(
          '⚠️ Failed to fetch dynamic languages from backend. Falling back to default locales [es, en].',
          error,
        );
        register({
          langDir: path.resolve(process.cwd(), 'locales'),
          locales: [
            {
              code: 'es',
              name: 'Español',
              files: getI18nFiles('es'),
              flagCode: 'es',
            },
            {
              code: 'en',
              name: 'English',
              files: getI18nFiles('en'),
              flagCode: 'gb',
            },
          ],
        });
      }
    },
  },
  i18n: {
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
    defaultLocale: 'es',
  },

  routeRules: {
    '/app/cms/**': { ssr: false },
    '/[lang]/page/**': { ssr: true },
    '/[lang]/pages': { ssr: true },
    '/[lang]/blog': { swr: 3600 },
    '/[lang]/blog/**': { swr: 3600 },
  },

  sitemap: {
    sources: ['/api/sitemap/blog', '/api/sitemap/cms-pages'],
  },
});
