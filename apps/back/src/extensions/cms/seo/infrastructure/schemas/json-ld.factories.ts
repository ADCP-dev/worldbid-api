import type {
  ArticleSchemaInput,
  BlogPostingSchemaInput,
  BlogPostingSchema,
  OrganizationSchemaInput,
  BreadcrumbSchemaInput,
  WebPageSchemaInput,
  WebSiteSchemaInput,
  ProductSchemaInput,
  ArticleSchema,
  OrganizationSchema,
  BreadcrumbListSchema,
  WebPageSchema,
  WebSiteSchema,
  ProductSchema,
} from './types';

// Article factory
export function createArticleSchema(input: ArticleSchemaInput): ArticleSchema {
  const appUrl = input.appUrl || 'https://example.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.metaTitle,
    description: input.metaDescription,
    image: input.ogImage?.url,
    datePublished: input.publishedAt?.toISOString(),
    author: input.author
      ? { '@type': 'Person', name: input.author }
      : undefined,
    url: `${appUrl}/blog/${input.slug}`,
  };
}

// Organization factory
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

// BreadcrumbList factory
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

// WebPage factory
export function createWebPageSchema(input: WebPageSchemaInput): WebPageSchema {
  const appUrl = input.appUrl || 'https://example.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.metaTitle,
    description: input.metaDescription,
    url: `${appUrl}/${input.slug}`,
  };
}

// WebSite factory
export function createWebSiteSchema(input: WebSiteSchemaInput): WebSiteSchema {
  const schema: WebSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: input.name,
    url: input.url,
  };

  if (input.potentialAction) {
    schema.potentialAction = {
      '@type': 'SearchAction',
      target: input.potentialAction.target,
      query: input.potentialAction.query,
    };
  }

  return schema;
}

// BlogPosting factory
export function createBlogPostingSchema(
  input: BlogPostingSchemaInput,
): BlogPostingSchema {
  const appUrl = input.appUrl || 'https://example.com';
  const url = `${appUrl}/blog/${input.slug}`;
  const schema: BlogPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.metaTitle,
    description: input.metaDescription,
    image: input.ogImage?.url,
    datePublished: input.publishedAt?.toISOString(),
    dateModified: input.publishedAt?.toISOString(),
    author: input.author
      ? { '@type': 'Person', name: input.author }
      : undefined,
    url,
    mainEntityOfPage: url,
  };
  if (input.publisherName) {
    schema.publisher = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: input.publisherName,
      logo: input.publisherLogo,
      url: appUrl,
    };
  }
  return schema;
}

// Product factory
export function createProductSchema(input: ProductSchemaInput): ProductSchema {
  const schema: ProductSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    image: input.image,
    brand: input.brand,
  };

  if (input.offers) {
    schema.offers = {
      '@type': 'Offer',
      price: input.offers.price,
      priceCurrency: input.offers.priceCurrency,
      availability: input.offers.availability,
    };
  }

  return schema;
}
