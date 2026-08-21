// RSS feed — published blog posts (FR-019, task 3.25).
import rss from '@astrojs/rss';
import { fetchApi, PUBLIC_API } from '../lib/api';
import { DEFAULT_LOCALE, type Locale } from '../i18n/ui';

interface BlogPost {
  slug: string;
  publishedAt?: string | null;
  translations?: Record<string, Record<string, string>>;
  [key: string]: unknown;
}
interface BlogListResponse {
  data: BlogPost[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const locale: Locale = DEFAULT_LOCALE;
const siteUrl =
  import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';

const result = await fetchApi<BlogListResponse>(PUBLIC_API.blogPosts, {
  lang: locale,
  searchParams: { page: 1, limit: 20 },
});

const posts = result?.data ?? [];

export async function GET(context: { site: URL }) {
  const items = posts.map((post) => {
    const translations = post.translations?.[locale] ?? {};
    const title = translations.title ?? (post as any).title ?? post.slug;
    const description = translations.excerpt ?? (post as any).excerpt ?? '';
    return {
      title,
      description,
      pubDate: post.publishedAt ? new Date(post.publishedAt) : new Date(),
      link: `${siteUrl}/blog/${post.slug}`,
    };
  });

  return rss({
    title: 'Foundation — Blog',
    description: 'Latest articles and updates',
    site: context.site ?? new URL(siteUrl),
    items,
  });
}