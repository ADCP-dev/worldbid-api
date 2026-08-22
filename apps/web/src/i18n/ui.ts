// i18n config + helpers for the Astro public web app.
// es = default (no prefix), en = /en/ prefix (prefixExceptDefault).
// UI strings: static JSON fallback dictionaries. Dynamic locales from backend.
//
// LIMITATION: Astro's build-time i18n routing requires a static `locales`
// array. We fetch it at build time via fetchLocales() in astro.config.mjs.
// Adding a NEW language requires a rebuild — the build picks up whatever
// langs are in the DB. The middleware handles any locale prefix dynamically
// at runtime, but page routing is build-time.

import esMessages from './es.json';
import enMessages from './en.json';

export const DEFAULT_LOCALE = 'es' as const;
export type Locale = string;

// Build-time known locales. At runtime, these may be extended by
// initLocales() from the backend — use getLocales() for the live list.
export const SUPPORTED_LOCALES = ['es', 'en'] as readonly string[];

// Static message dictionaries — only for locales with JSON files.
// New backend langs without a JSON file fall back to the default locale.
const STATIC_MESSAGES: Record<string, Record<string, string>> = {
  es: esMessages,
  en: enMessages,
};

export function getStaticMessages(locale: string): Record<string, string> {
  return STATIC_MESSAGES[locale] ?? STATIC_MESSAGES[DEFAULT_LOCALE];
}

// Resolve locale from URL pathname: '/en/...' → 'en', everything else → 'es'.
// Uses a dynamic regex so it works for any locale prefix, not just hardcoded 'en'.
export function localeFromPath(pathname: string, locales: readonly string[] = SUPPORTED_LOCALES): string {
  for (const loc of locales) {
    if (loc === DEFAULT_LOCALE) continue; // default has no prefix
    const re = new RegExp(`^/${loc}(?:/|$)`);
    if (re.test(pathname)) return loc;
  }
  return DEFAULT_LOCALE;
}

// Strip the locale prefix from a pathname: '/en/blog' → '/blog', '/blog' → '/blog'.
export function stripLocalePrefix(pathname: string, locales: readonly string[] = SUPPORTED_LOCALES): string {
  for (const loc of locales) {
    if (loc === DEFAULT_LOCALE) continue;
    const re = new RegExp(`^/${loc}(?=/|$)`);
    const stripped = pathname.replace(re, '');
    if (stripped !== pathname) return stripped || '/';
  }
  return pathname;
}

// Translate a key for a locale using the static fallback dictionary.
// If the locale has no static messages (e.g. a new backend lang), falls back
// to the default locale's messages.
export function t(locale: string, key: string): string {
  const messages = getStaticMessages(locale);
  return messages[key] ?? key;
}