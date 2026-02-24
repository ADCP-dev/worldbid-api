// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
import path from "path";

function getI18nFiles(langCode: string) {
  return ["dynamic-loader.ts"]
}

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  extends: ["./modules/landing", "./modules/auth", "./modules/ui-app", "./modules/translations"],
  devtools: { enabled: true },
  ssr: false,
  // Configure error handling
  app: {
    // Global error handling
    head: {
      titleTemplate: "%s - " + (process.env.APP_NAME || "Foundation"),
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
    },
  },

  runtimeConfig: {
    public: {
      appName: process.env.APP_NAME || "Foundation",
      mainAppRoute: process.env.MAIN_APP_ROUTE || "/app",
      apiUrl: process.env.API_URL || "http://localhost:3001",
      apiPrefix: process.env.API_PREFIX || "/api/v1",
      env: process.env.ENV || "development",
    },
  },

  modules: [
    "@nuxt/image",
    "@nuxt/fonts",
    "@nuxt/eslint",
    "@nuxt/test-utils",
    "@pinia/nuxt",
    "pinia-plugin-persistedstate",
    "@nuxtjs/i18n",
    "@nuxtjs/sitemap",
    "@nuxtjs/color-mode",
    "@nuxtjs/robots",
    "shadcn-nuxt",
    'vue-sonner/nuxt'
  ],
  css: ["~/assets/css/tailwind.css", "flag-icons/css/flag-icons.min.css"],
  vite: {
    plugins: [tailwindcss()],
  },
  colorMode: {
    classSuffix: "",
  },
  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: "",
    /**
     * Directory that the component lives in.
     * @default "./components/ui"
     */
    componentDir: "./components/ui",
  },
  hooks: {
    async "i18n:registerModule"(register) {
      try {
        // Fetch active languages directly from the backend during Nuxt startup
        const apiUrl = process.env.API_URL || "http://localhost:3001";
        const apiPrefix = process.env.API_PREFIX || "/api/v1";

        // Use native fetch to get the langs from the database
        const res = await fetch(`${apiUrl}${apiPrefix}/translations/langs`);
        const langsDb = await res.json();

        // Map database languages to Nuxt i18n locales format
        const dynamicLocales = langsDb
          .filter((lang: any) => lang.isActive) // Guarantee we only register active ones
          .map((lang: any) => ({
            code: lang.code,
            name: lang.name,
            files: getI18nFiles(lang.code),
            flagCode: lang.flagCode || lang.code
          }));

        // Fallback to static if backend is unreachable during build
        const localesToRegister = dynamicLocales.length > 0
          ? dynamicLocales
          : [
              { code: "es", name: "Español", files: getI18nFiles("es"), flagCode: "es" },
              { code: "en", name: "English", files: getI18nFiles("en"), flagCode: "gb" },
            ];

        register({
          langDir: path.resolve(process.cwd(), "locales"),
          locales: localesToRegister,
        });
      } catch (error) {
        console.warn("⚠️ Failed to fetch dynamic languages from backend. Falling back to default locales [es, en].", error);
        register({
          langDir: path.resolve(process.cwd(), "locales"),
          locales: [
            { code: "es", name: "Español", files: getI18nFiles("es"), flagCode: "es" },
            { code: "en", name: "English", files: getI18nFiles("en"), flagCode: "gb" },
          ],
        });
      }
    },
  },
  i18n: {
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_redirected",
      redirectOn: "root",
    },
    defaultLocale: "es",
    lazy: true,
  },
});
