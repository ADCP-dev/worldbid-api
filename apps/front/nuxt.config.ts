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
  ssr: true,

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
    '@nuxt/eslint',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate',
    '@nuxtjs/i18n',
    '@nuxtjs/sitemap',
    '@nuxtjs/color-mode',
    '@nuxtjs/robots',
  ],
  css: ['~/assets/css/tailwind.css'],
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
    vueI18n: './i18n.config.ts',
    strategy: 'prefix_and_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
    defaultLocale: 'es',
    langDir: 'locales',
    // Static fallback locales for build-time route generation
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
  },

  site: {
    url: process.env.SITE_URL || 'http://localhost',
  },

  routeRules: {
    // Root and language homepages
    '/': { prerender: true },
    '/es': { prerender: true },
    '/en': { prerender: true },
    // Admin/app routes - client-side only SPA shell
    '/app/**': { ssr: false, prerender: true },
    // Public CMS routes - prerender at build time
    '/[lang]/page/**': { prerender: true },
    '/[lang]/pages': { prerender: true },
    '/[lang]/blog': { prerender: true },
    '/[lang]/blog/**': { prerender: true },
    '/[lang]/category/**': { prerender: true },
    // Fallback: don't prerender unknown routes
    '/**': { prerender: false },
  },

  sitemap: {
    // Only use dynamic sources when backend is available
    sources: process.env.API_URL
      ? ['/api/sitemap/blog', '/api/sitemap/cms-pages']
      : [],
    urls: {
      each: (entry) => {
        const locales = ['es', 'en'];
        return locales.map((lang) => ({
          loc: entry.loc.replace(/^\//, `/${lang}/`),
          hreflang: lang,
        }));
      },
    },
  },

  // SSG Prerender configuration
  nitro: {
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: ['/', '/es', '/en'],
      failOnError: false, // Don't fail build on missing backend data
    },
  },

  robots: {
    UserAgent: '*',
    Disallow: ['/app/cms/', '/api/'],
    Allow: '/',
    Sitemap: '/sitemap.xml',
  },
});
