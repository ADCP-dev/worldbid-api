// Backend API client for the Astro public web app.
// Every call appends ?lang=<locale> as the primary locale mechanism (R-PWA-06).

import type { Locale } from '../i18n/ui';

const API_URL = import.meta.env.API_URL || process.env.API_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v1';

export interface FetchApiOptions {
  lang: Locale;
  searchParams?: Record<string, string | number | boolean | undefined>;
  init?: RequestInit;
}

// Build a fully-qualified NestJS API URL with ?lang and extra query params.
export function buildApiUrl(
  path: string,
  { lang, searchParams }: FetchApiOptions,
): string {
  const url = new URL(
    path.startsWith('/') ? `${API_URL}${API_PREFIX}${path}` : `${API_URL}${API_PREFIX}/${path}`,
  );
  url.searchParams.set('lang', lang);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

// Fetch JSON from the NestJS API. Always passes ?lang=. Returns null on network error
// so callers can fall back to static content (R-PWA-07).
export async function fetchApi<T>(
  path: string,
  { lang, searchParams, init }: FetchApiOptions,
): Promise<T | null> {
  try {
    const url = buildApiUrl(path, { lang, searchParams });
    const res = await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const PUBLIC_API = {
  // CMS blog
  blogPosts: '/cms/blog/posts/public',
  blogPost: (slug: string) => `/cms/blog/posts/public/${slug}`,
  blogPostRelated: (slug: string) => `/cms/blog/posts/public/${slug}/related`,
  blogPostsByCategory: (categoryId: string) => `/cms/blog/posts/public/category/${categoryId}`,
  blogCategories: '/cms/blog/categories/public',
  blogCategoryBySlug: (slug: string) => `/cms/blog/categories/public/by-slug/${slug}`,
  blogTags: '/cms/blog/tags/public',
  // CMS pages + SEO
  cmsPages: '/cms/pages/public',
  cmsPage: (slug: string) => `/cms/pages/public/${slug}`,
  seoByPageId: (pageId: string) => `/cms/seo/${pageId}`,
  seoTemplate: (type: string) => `/cms/seo/template/${type}`,
  // Translations
  translationsExactByPath: '/translations/exact-by-path',
  translationsLangs: '/translations/langs',
} as const;