/**
 * JSON-LD Schema Factory Functions
 * Mirrors backend factories in apps/back/src/modules/cms/seo/infrastructure/schemas/json-ld.factories.ts
 * These are used by useSchema composable to generate structured data for search engines
 */

import type {
  JsonLdSchema,
  ArticleSchema,
  OrganizationSchema,
  BreadcrumbListSchema,
  WebPageSchema,
  WebSiteSchema,
  ProductSchema,
  ArticleSchemaInput,
  OrganizationSchemaInput,
  BreadcrumbSchemaInput,
  WebPageSchemaInput,
  WebSiteSchemaInput,
  ProductSchemaInput,
} from '../types/json-ld';

// Application URL - comes from runtime config
function getAppUrl(): string {
  try {
    const config = useRuntimeConfig();
    return config.public.apiUrl || 'https://example.com';
  } catch {
    return 'https://example.com';
  }
}

/**
 * Create an Article schema (BlogPost, NewsArticle, etc.)
 * Used for blog posts and articles with author, date, and publisher info
 */
export function createArticleSchema(input: ArticleSchemaInput): ArticleSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.metaTitle,
    description: input.metaDescription,
    image: input.ogImage?.url,
    datePublished: input.publishedAt,
    author: input.author
      ? { '@type': 'Person', name: input.author }
      : undefined,
    url: `${getAppUrl()}/blog/${input.slug}`,
  };
}

/**
 * Create an Organization schema
 * Used for company/brand information with logo and social links
 */
export function createOrganizationSchema(
  input: OrganizationSchemaInput,
): OrganizationSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    url: input.url,
    logo: input.logo,
    sameAs: input.sameAs,
  };
}

/**
 * Create a BreadcrumbList schema
 * Used for navigation breadcrumb trails
 * Each segment has position, name, and URL
 */
export function createBreadcrumbSchema(
  input: BreadcrumbSchemaInput,
): BreadcrumbListSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: input.pathSegments.map((segment, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: segment.name,
      item: segment.url,
    })),
  };
}

/**
 * Create a WebPage schema
 * Used for generic web pages
 */
export function createWebPageSchema(input: WebPageSchemaInput): WebPageSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.metaTitle,
    description: input.metaDescription,
    url: `${getAppUrl()}/${input.slug}`,
  };
}

/**
 * Create a WebSite schema
 * Used for website-level metadata with optional search action
 */
export function createWebSiteSchema(input: WebSiteSchemaInput): WebSiteSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: input.name,
    url: input.url,
    potentialAction: input.potentialAction,
  };
}

/**
 * Create a Product schema
 * Used for product pages with pricing and availability
 */
export function createProductSchema(input: ProductSchemaInput): ProductSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    image: input.image,
    brand: input.brand,
    offers: input.offers
      ? {
          '@type': 'Offer',
          price: input.offers.price,
          priceCurrency: input.offers.priceCurrency,
          availability: input.offers.availability,
        }
      : undefined,
  };
}

// Factory registry type
type SchemaFactory<T> = (input: T) => JsonLdSchema;

// Schema factory registry
const factories: Record<string, SchemaFactory<any>> = {
  Article: createArticleSchema,
  BreadcrumbList: createBreadcrumbSchema,
  Organization: createOrganizationSchema,
  WebPage: createWebPageSchema,
  WebSite: createWebSiteSchema,
  Product: createProductSchema,
};

/**
 * Generate a JSON-LD schema by type
 * Returns null if type is not supported
 */
export function generateSchema<T extends Record<string, any>>(
  type: string,
  input: T,
): JsonLdSchema | null {
  const factory = factories[type];
  if (!factory) {
    return null;
  }
  return factory(input);
}