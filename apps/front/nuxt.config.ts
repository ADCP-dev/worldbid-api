// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";

function getI18nFiles(langCode: string) {
  const langDir = path.resolve(process.cwd(), "locales", langCode);
  if (!fs.existsSync(langDir)) {
    // Support legacy flat file temporarily if directory doesn't exist
    return [`${langCode}.json`];
  }
  return fs
    .readdirSync(langDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => `${langCode}/${file}`);
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
  hooks: {
    "i18n:registerModule"(register) {
      register({
        langDir: path.resolve(process.cwd(), "locales"),
        locales: [
          { code: "es", name: "Español", files: getI18nFiles("es") },
          { code: "en", name: "English", files: getI18nFiles("en") },
        ],
      });
    },
  },
  i18n: {
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_redirected",
      redirectOn: "root",
    },
    defaultLocale: "es",
    locales: [
      { code: "es", name: "Español" },
      { code: "en", name: "English" },
    ],
    lazy: true,
  },
});
