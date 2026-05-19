/**
 * Sitemap blog source — fetches blog post URLs from NestJS backend,
 * transforms full URLs to paths and alternates.languages to alternatives array.
 *
 * @nuxtjs/sitemap auto-detects @nuxtjs/i18n and generates per-locale sitemaps.
 * With prefix_except_default, Spanish is default (no prefix), English gets /en/.
 */
import { defineSitemapEventHandler } from '#imports'
import type { SitemapUrl } from '#sitemap/types'

interface BackendSitemapEntry {
  loc: string
  lastmod: string
  changefreq: string
  priority: number
  alternates?: {
    languages: Record<string, string>
  }
}

export default defineSitemapEventHandler(async () => {
  const config = useRuntimeConfig()
  const apiUrl = `${config.public.apiUrl}${config.public.apiPrefix}/sitemap/blog`

  try {
    const data = await $fetch<BackendSitemapEntry[]>(apiUrl)

    return data.map((entry) => {
      // Strip base URL to get path (e.g. http://localhost:3000/blog/post → /blog/post)
      const loc = entry.loc.replace(config.public.apiUrl, '') || entry.loc

      // Transform { languages: { es: '...', en: '...' } } → [{ hreflang: 'es', href: '...' }]
      const alternatives = entry.alternates?.languages
        ? Object.entries(entry.alternates.languages).map(([hreflang, href]) => ({
            hreflang,
            href,
          }))
        : undefined

      return {
        loc,
        lastmod: entry.lastmod,
        changefreq: (entry.changefreq || 'weekly') as SitemapUrl['changefreq'],
        priority: (entry.priority || 0.8) as SitemapUrl['priority'],
        alternatives,
        _i18nTransform: true,
      }
    })
  } catch (error) {
    console.error('[sitemap/blog] Failed to fetch:', error)
    return []
  }
})
