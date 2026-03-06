import * as z from 'zod';

export default defineNuxtPlugin({
  name: 'zod-locale',
  parallel: true,
  async setup(nuxtApp) {
    const i18n = (nuxtApp as any).$i18n;

    const localesMap: Record<string, () => Promise<any>> = {
      'en': () => import('zod/v4/locales/en.js'),
      'es': () => import('zod/v4/locales/es.js'),
      'fr': () => import('zod/v4/locales/fr.js'),
      'de': () => import('zod/v4/locales/de.js'),
      'it': () => import('zod/v4/locales/it.js'),
      'pt': () => import('zod/v4/locales/pt.js'),
      'nl': () => import('zod/v4/locales/nl.js'),
    };

    const loadZodLocale = async (localeCode: string) => {
      try {
        let localeModule;
        if (localesMap[localeCode]) {
          localeModule = await localesMap[localeCode]();
        } else {
          // Fallback for uncommon locales, suppressing Vite warning
          localeModule = await import(/* @vite-ignore */ `zod/v4/locales/${localeCode}.js`);
        }

        if (localeModule?.default) {
          z.config(localeModule.default());
        }
      } catch (error) {
        console.warn(`[zod-locale] Failed to load Zod locale: ${localeCode}`, error);
      }
    };

    if (i18n?.locale?.value) {
      await loadZodLocale(i18n.locale.value);
    }

    if (i18n?.locale) {
      watch(i18n.locale, async (newLocale: string) => {
        await loadZodLocale(newLocale);
      }, { immediate: false });
    }
  }
});
