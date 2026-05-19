/**
 * Sitemap CMS pages proxy — fetches page URLs from NestJS backend
 * and returns them in @nuxtjs/sitemap expected format.
 */
export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const apiUrl = `${config.public.apiUrl}${config.public.apiPrefix}/sitemap/pages`;

  try {
    const data = await $fetch<Array<{ loc: string; lastmod: string; changefreq: string; priority: number }>>(apiUrl);
    return data.map((entry) => ({
      loc: entry.loc,
      lastmod: entry.lastmod,
      changefreq: entry.changefreq || 'monthly',
      priority: entry.priority || 0.6,
    }));
  } catch (error) {
    console.error('[sitemap/cms-pages] Failed to fetch:', error);
    return [];
  }
});
