// i18n locale middleware — strips the locale prefix so root pages handle it.
// Dynamic locales: fetched from the backend at server startup and cached.
//
// Default locale (es) has no prefix; all other active locales use /<code>/ prefix
// (prefixExceptDefault routing). Astro does not auto-mirror pages for
// prefixExceptDefault, so we rewrite here:
//   /en        -> /   (locals.locale = 'en')
//   /en/blog   -> /blog (locals.locale = 'en')
//   /blog      -> /blog (locals.locale = 'es')
// `next(path)` rewrites the request in place; locals persist across the rewrite.
import { defineMiddleware } from 'astro:middleware';
import { DEFAULT_LOCALE, type Locale } from './i18n/ui';
import { getLocales, initLocales } from './lib/locales';

let localesInitialized = false;

export const onRequest = defineMiddleware(async (context, next) => {
  // Lazy-init locales on first request (once per server lifecycle)
  if (!localesInitialized) {
    const apiUrl = (import.meta.env.API_URL || 'http://127.0.0.1:3010').replace(/\/$/, '');
    await initLocales(apiUrl);
    localesInitialized = true;
  }

  const { pathname } = context.url;
  const activeLocales = getLocales();

  // Check if the pathname starts with any non-default locale prefix
  for (const loc of activeLocales) {
    if (loc === DEFAULT_LOCALE) continue;
    const prefix = `/${loc}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      context.locals.locale = loc satisfies Locale;
      const stripped = pathname.replace(new RegExp(`^/${loc}`), '') || '/';
      return next(stripped);
    }
  }

  context.locals.locale = DEFAULT_LOCALE satisfies Locale;
  return next();
});