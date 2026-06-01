/**
 * Sitemap CMS pages source — fetches page URLs from NestJS backend,
 * transforms full URLs to paths and alternates.languages to alternatives array.
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
  const apiUrl = `${config.public.apiUrl}${config.public.apiPrefix}/sitemap/pages`

  try {
    const data = await $fetch<BackendSitemapEntry[]>(apiUrl)

    return data.map((entry) => {
      const loc = entry.loc.replace(/^https?:\/\/[^/]+/, '') || entry.loc

      const alternatives = entry.alternates?.languages
        ? Object.entries(entry.alternates.languages).map(([hreflang, href]) => ({
            hreflang,
            href,
          }))
        : undefined

      return {
        loc,
        lastmod: entry.lastmod,
        changefreq: (entry.changefreq || 'monthly') as SitemapUrl['changefreq'],
        priority: (entry.priority || 0.6) as SitemapUrl['priority'],
        alternatives,
        _i18nTransform: true,
      }
    })
  } catch (error) {
    console.error('[sitemap/cms-pages] Failed to fetch:', error)
    return []
  }
})
