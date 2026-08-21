/**
 * i18n configuration — single source of truth for supported locales.
 * Used by:
 * - nuxt.config.ts → i18n.locales + prerender seeds
 * - (sitemap now centralized in Astro apps/web via @astrojs/sitemap)
 *
 * To add a locale:
 * 1. Add its code to SUPPORTED_LOCALES
 * 2. Create its JSON files in i18n/locales/{code}/
 * 3. Add translation files registration
 *
 * DEFAULT_LOCALE determines which locale has NO URL prefix (prefix_except_default).
 * All others get /{locale}/ prefix in URLs.
 */
export const SUPPORTED_LOCALES = ['es', 'en'] as const

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: LocaleCode = 'es'

/**
 * Build localized route paths for prerender seeds and sitemap entries.
 * @param paths - Paths without locale prefix (e.g. ['/', '/calculadoras'])
 * @returns Array with each path × each locale (e.g. ['/', '/calculadoras', '/en/', '/en/calculadoras'])
 */
export function localizedRoutes(paths: readonly string[]): string[] {
  return SUPPORTED_LOCALES.flatMap((locale) => {
    const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`
    return paths.map((path) => `${prefix}${path}`)
  })
}
