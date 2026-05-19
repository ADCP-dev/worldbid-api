/**
 * Sitemap blog proxy — fetches blog post URLs from NestJS backend
 * and returns them in @nuxtjs/sitemap expected format.
 */
export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const apiUrl = `${config.public.apiUrl}${config.public.apiPrefix}/sitemap/blog`;

  try {
    const data = await $fetch<Array<{ loc: string; lastmod: string; changefreq: string; priority: number }>>(apiUrl);
    return data.map((entry) => ({
      loc: entry.loc,
      lastmod: entry.lastmod,
      changefreq: entry.changefreq || 'weekly',
      priority: entry.priority || 0.8,
    }));
  } catch (error) {
    console.error('[sitemap/blog] Failed to fetch:', error);
    return [];
  }
});
