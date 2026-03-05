import * as z from 'zod';

export default defineNuxtPlugin({
  name: 'zod-locale',
  parallel: true,
  async setup(nuxtApp) {
    const i18n = (nuxtApp as any).$i18n;

    const loadZodLocale = async (localeCode: string) => {
      try {
        const mod = await import(`zod/v4/locales/${localeCode}.js`);
        if (mod && mod.default) {
          z.config(mod.default());
        }
      } catch (error) {
        console.warn(`[zod-locale] Failed to load Zod locale: ${localeCode}`, error);
      }
    };

    if (i18n?.locale?.value) {
      await loadZodLocale(i18n.locale.value);
    }

    // @ts-ignore
    nuxtApp.hook('i18n:beforeLanguageSwitch', async ({ newLocale }) => {
      await loadZodLocale(newLocale);
    });
  }
});
