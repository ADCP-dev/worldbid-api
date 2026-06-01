/**
 * Sitemap categories source — fetches blog categories from NestJS backend
 * and returns sitemap URLs for /blog/c/[slug] routes.
 *
 * Uses the unprotected public endpoint to get all categories.
 */
import { defineSitemapEventHandler } from '#imports'
import type { SitemapUrl } from '#sitemap/types'

interface Category {
  id: string
  slug: string
  name: string
}

export default defineSitemapEventHandler(async () => {
  const config = useRuntimeConfig()
  const apiUrl = `${config.public.apiUrl}${config.public.apiPrefix}/cms/blog/categories/public`

  try {
    const categories = await $fetch<Category[]>(apiUrl)

    return categories.map((cat) => ({
      loc: `/blog/c/${cat.slug}`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly' as SitemapUrl['changefreq'],
      priority: 0.6 as SitemapUrl['priority'],
      _i18nTransform: true,
    }))
  } catch (error) {
    console.error('[sitemap/categories] Failed to fetch:', error)
    return []
  }
})
