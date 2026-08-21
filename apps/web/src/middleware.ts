// i18n locale middleware — strips the /en prefix so root pages handle English.
// es = default (no prefix), en = /en/ prefix (prefixExceptDefault routing).
// Astro does not auto-mirror pages for prefixExceptDefault, so we rewrite here:
//   /en        -> /   (locals.locale = 'en')
//   /en/blog   -> /blog (locals.locale = 'en')
//   /blog      -> /blog (locals.locale = 'es')
// `next(path)` rewrites the request in place; locals persist across the rewrite.
import { defineMiddleware } from 'astro:middleware';
import { DEFAULT_LOCALE, type Locale } from './i18n/ui';

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;

  if (pathname === '/en' || pathname.startsWith('/en/')) {
    context.locals.locale = 'en' satisfies Locale;
    const stripped = pathname.replace(/^\/en/, '') || '/';
    return next(stripped);
  }

  context.locals.locale = DEFAULT_LOCALE satisfies Locale;
  return next();
});