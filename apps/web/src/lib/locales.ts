// Dynamic locale management — fetched from the backend translations API.
// Cached at server startup so per-request middleware stays fast.

import type { Locale } from '../i18n/ui';

interface LangResponse {
  code: string;
  isActive: boolean;
}

const DEFAULT_LOCALES: Locale[] = ['es', 'en'];
const DEFAULT_DEFAULT: Locale = 'es';

let cachedLocales: Locale[] = DEFAULT_LOCALES;
let defaultLocale: Locale = DEFAULT_DEFAULT;
let initialized = false;

/**
 * Fetch active languages from the backend and cache them.
 * Called once at server startup. Safe to call multiple times —
 * subsequent calls are no-ops once initialized.
 *
 * @param apiUrl Base API URL (e.g. http://127.0.0.1:3010)
 */
export async function initLocales(apiUrl: string): Promise<void> {
  if (initialized) return;
  try {
    const res = await fetch(`${apiUrl}/api/v1/translations/langs`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const langs = (await res.json()) as LangResponse[];
    const active = langs
      .filter((l) => l.isActive)
      .map((l) => l.code as Locale)
      .filter((l) => l.length > 0);

    if (active.length > 0) {
      cachedLocales = active;
      // Keep 'es' as default if available, otherwise use the first active lang
      defaultLocale = active.includes('es')
        ? 'es'
        : (active[0] as Locale);
    }
    initialized = true;
    console.log(`[locales] Cached from API: ${cachedLocales.join(', ')} (default: ${defaultLocale})`);
  } catch (e) {
    initialized = true;
    console.warn(
      `[locales] Failed to fetch, using defaults: ${DEFAULT_LOCALES.join(', ')}`,
      e instanceof Error ? e.message : String(e),
    );
  }
}

export function getLocales(): Locale[] {
  return cachedLocales;
}

export function getDefaultLocale(): Locale {
  return defaultLocale;
}

/**
 * Check if a locale string is in the cached active locales.
 */
export function isActiveLocale(code: string): code is Locale {
  return cachedLocales.includes(code as Locale);
}