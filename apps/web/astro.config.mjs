import { defineConfig } from 'astro/config';
// node adapter removed — static output doesn't need an SSR adapter
// import node from '@astrojs/node';
import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const SITE_URL = (process.env.PUBLIC_SITE_URL || 'http://localhost:4321').replace(/\/$/, '');
const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const API_PREFIX = '/api/v1';

// ─── Dynamic locales from backend ─────────────────────────────────────────
// Fetched at BUILD time so Astro's static i18n routing config reflects
// whatever langs are active in the DB. Adding a NEW language requires a
// rebuild. At runtime, the middleware re-fetches and handles any locale
// prefix dynamically (see src/lib/locales.ts + src/middleware.ts).
const DEFAULT_LOCALES = ['es', 'en'];

async function fetchLocales() {
  try {
    const res = await fetch(`${API_URL}${API_PREFIX}/translations/langs`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const langs = await res.json();
    const active = langs
      .filter((l) => l.isActive)
      .map((l) => l.code)
      .filter((c) => c.length > 0);
    if (active.length > 0) {
      console.log(`[astro] Locales from API: ${active.join(', ')}`);
      return active;
    }
  } catch (e) {
    console.warn(
      `[astro] Failed to fetch locales, using default: ${DEFAULT_LOCALES.join(', ')}`,
      e.message,
    );
  }
  return DEFAULT_LOCALES;
}

const locales = await fetchLocales();
const defaultLocale = locales.includes('es') ? 'es' : locales[0];

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function toArray(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  return [];
}

async function fetchDynamicPageUrls() {
  // Generate paths for the default locale (no prefix) + all non-default locales
  const nonDefault = locales.filter((l) => l !== defaultLocale);
  const paths = [];
  for (const l of nonDefault) {
    paths.push(`/${l}`, `/${l}/blog/`);
  }

  const [postsBody, catsBody, tagsBody, pagesBody] = await Promise.all([
    fetchJson(`${API_URL}${API_PREFIX}/cms/blog/posts/public?limit=100`),
    fetchJson(`${API_URL}${API_PREFIX}/cms/blog/categories/public`),
    fetchJson(`${API_URL}${API_PREFIX}/cms/blog/tags/public`),
    fetchJson(`${API_URL}${API_PREFIX}/cms/pages/public`),
  ]);

  for (const post of toArray(postsBody)) {
    if (post.slug) {
      paths.push(`/blog/${post.slug}`);
      for (const l of nonDefault) paths.push(`/${l}/blog/${post.slug}`);
    }
  }
  for (const cat of toArray(catsBody)) {
    if (cat.slug) {
      paths.push(`/blog/c/${cat.slug}`);
      for (const l of nonDefault) paths.push(`/${l}/blog/c/${cat.slug}`);
    }
  }
  for (const tag of toArray(tagsBody)) {
    if (tag.slug) {
      paths.push(`/blog/t/${tag.slug}`);
      for (const l of nonDefault) paths.push(`/${l}/blog/t/${tag.slug}`);
    }
  }
  for (const page of toArray(pagesBody)) {
    if (page.slug) {
      paths.push(`/${page.slug}`);
      for (const l of nonDefault) paths.push(`/${l}/${page.slug}`);
    }
  }
  return paths.map((p) => `${SITE_URL}${p}`);
}

// Astro public web app. Static output (nginx-servable on Coolify).
export default defineConfig({
  output: 'static',
  site: SITE_URL,

  i18n: {
    defaultLocale,
    locales,
    routing: {
      prefixExceptDefault: true,
    },
  },

  integrations: [
    vue(),
    sitemap({
      // tag 'sitemap' used by /api/revalidate for on-demand purge
      filter: (page) => !page.includes('/app/') && !page.includes('/admin/'),
      i18n: {
        defaultLocale,
        locales: Object.fromEntries(
          locales.map((l) => [l, l === 'es' ? 'es-ES' : l === 'en' ? 'en-US' : l]),
        ),
      },
      customPages: await fetchDynamicPageUrls(),
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  // routeRules with cache/swr require SSR adapter; removed for static output.

  server: {
    port: 4321,
    host: true,
  },
});