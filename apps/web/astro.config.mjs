import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Astro 7 SSR public web app. Standalone Node server (Coolify).
// ISR DIY: routeRules declare cache + tags; /api/revalidate purges by tag.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  site: process.env.PUBLIC_SITE_URL || 'http://localhost:4321',

  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixExceptDefault: true,
    },
  },

  integrations: [
    vue(),
    sitemap({
      // tag 'sitemap' used by /api/revalidate for on-demand purge
      filter: (page) => !page.includes('/app/') && !page.includes('/admin/'),
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  routeRules: {
    // Landing — long cache, SWR for stale-while-revalidate
    '/': { cache: { maxAge: 3600, swr: 60, tags: ['home'] } },
    // Blog list + detail + category + tag — short cache, SWR
    '/blog': { cache: { maxAge: 300, swr: 60, tags: ['blog', 'blog-index'] } },
    '/blog/**': { cache: { maxAge: 300, swr: 60, tags: ['blog'] } },
    // CMS pages — medium cache
    '/page/**': { cache: { maxAge: 600, swr: 60, tags: ['pages'] } },
    // Blog search — no server cache (client island fetches runtime)
    '/blog/search': { cache: false },
    // Sitemap routes — tag for on-demand purge
    '/sitemap-index.xml': { cache: { maxAge: 3600, tags: ['sitemap'] } },
    '/sitemap-*.xml': { cache: { maxAge: 3600, tags: ['sitemap'] } },
    // Revalidate endpoint — never cached
    '/api/revalidate': { cache: false },
  },

  server: {
    port: 4321,
    host: true,
  },
});