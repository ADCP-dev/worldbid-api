// WebPage schema
export const WebPageSchema = (
  page: { slug: string },
  seo: { metaTitle?: string | null; metaDescription?: string | null },
) => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: seo.metaTitle,
  description: seo.metaDescription,
  url: `${process.env.APP_URL}/${page.slug}`,
});

// Article schema (for blog posts)
export const ArticleSchema = (
  post: { slug: string; publishedAt?: Date | null },
  seo: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    ogImage?: { url: string } | null;
  },
  author?: string,
) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: seo.metaTitle,
  description: seo.metaDescription,
  image: seo.ogImage?.url || null,
  datePublished: post.publishedAt,
  author: author ? { '@type': 'Person', name: author } : undefined,
  url: `${process.env.APP_URL}/blog/${post.slug}`,
});

// WebSite schema (for home page)
export const WebSiteSchema = (siteName: string) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteName,
  url: process.env.APP_URL,
});
