// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  extends: ["./modules/landing", "./modules/auth", "./modules/ui-app"],
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
  ],
  css: ["~/assets/css/tailwind.css"],
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
  i18n: {
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_redirected",
      redirectOn: "root",
    },
    defaultLocale: "es",
    locales: [
      { code: "es", name: "Español", file: "es.json" },
      { code: "en", name: "English", file: "en.json" },
    ],
    lazy: true,
    bundle: {
      optimizeTranslationDirective: false,
    },
  },
});
