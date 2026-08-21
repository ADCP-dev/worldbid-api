// i18n config + helpers for the Astro public web app.
// es = default (no prefix), en = /en/ prefix (prefixExceptDefault).
// UI strings: fetched from NestJS translations API, fallback to static JSON.

import esMessages from './es.json';
import enMessages from './en.json';

export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export const DEFAULT_LOCALE = 'es' as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const STATIC_MESSAGES: Record<Locale, Record<string, string>> = {
  es: esMessages,
  en: enMessages,
};

export function getStaticMessages(locale: Locale): Record<string, string> {
  return STATIC_MESSAGES[locale] ?? STATIC_MESSAGES[DEFAULT_LOCALE];
}

// Resolve locale from URL pathname: '/en/...' → 'en', everything else → 'es'.
export function localeFromPath(pathname: string): Locale {
  const match = pathname.match(/^\/(en)(?:\/|$)/);
  return match ? (match[1] as Locale) : DEFAULT_LOCALE;
}

// Strip the locale prefix from a pathname: '/en/blog' → '/blog', '/blog' → '/blog'.
export function stripLocalePrefix(pathname: string): string {
  return pathname.replace(/^\/(en)(?=\/|$)/, '') || '/';
}

// Translate a key for a locale using the static fallback dictionary.
export function t(locale: Locale, key: string): string {
  return getStaticMessages(locale)[key] ?? key;
}