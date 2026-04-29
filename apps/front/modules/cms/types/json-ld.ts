/**
 * JSON-LD Schema Types for CMS Frontend
 * Mirrors backend schema types in apps/back/src/modules/cms/seo/infrastructure/schemas/types.ts
 */

// Base JSON-LD schema interface
export interface JsonLdSchema {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: unknown;
}

// Schema type union - all supported schema types
export type SchemaType =
  | 'Article'
  | 'BreadcrumbList'
  | 'Organization'
  | 'WebPage'
  | 'WebSite'
  | 'Product';

// Article schema - for blog posts and news articles
export interface ArticleSchema extends JsonLdSchema {
  '@type': 'Article';
  headline: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: PersonSchema;
  url: string;
  publisher?: OrganizationSchema;
}

// Organization schema - for company/brand information
export interface OrganizationSchema extends JsonLdSchema {
  '@type': 'Organization';
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
}

// BreadcrumbList schema - for breadcrumb navigation
export interface BreadcrumbListSchema extends JsonLdSchema {
  '@type': 'BreadcrumbList';
  itemListElement: BreadcrumbItem[];
}

export interface BreadcrumbItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item?: string;
}

// WebPage schema - for generic web pages
export interface WebPageSchema extends JsonLdSchema {
  '@type': 'WebPage';
  name?: string;
  description?: string;
  url: string;
}

// WebSite schema - for website-level metadata
export interface WebSiteSchema extends JsonLdSchema {
  '@type': 'WebSite';
  name: string;
  url: string;
  potentialAction?: PotentialActionSchema;
}

export interface PotentialActionSchema {
  '@type': 'SearchAction';
  target: string;
  query: string;
}

// Product schema - for product pages
export interface ProductSchema extends JsonLdSchema {
  '@type': 'Product';
  name: string;
  description: string;
  image?: string;
  brand?: string;
  offers?: OfferSchema;
}

export interface OfferSchema {
  '@type': 'Offer';
  price: string;
  priceCurrency: string;
  availability?: string;
}

export interface PersonSchema {
  '@type': 'Person';
  name: string;
}

// Factory input types - used by composables to generate schemas

export interface ArticleSchemaInput {
  slug: string;
  publishedAt?: string | null;
  metaTitle: string;
  metaDescription?: string;
  ogImage?: { url: string } | null;
  author?: string;
}

export interface OrganizationSchemaInput {
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
}

export interface BreadcrumbSchemaInput {
  pathSegments: Array<{ name: string; url: string }>;
}

export interface WebPageSchemaInput {
  slug: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface WebSiteSchemaInput {
  name: string;
  url: string;
  potentialAction?: PotentialActionSchema;
}

export interface ProductSchemaInput {
  name: string;
  description: string;
  image?: string;
  brand?: string;
  offers?: OfferSchema;
}

// SchemaOutput type that represents the final JSON-LD object structure
export type SchemaOutput =
  | ArticleSchema
  | OrganizationSchema
  | BreadcrumbListSchema
  | WebPageSchema
  | WebSiteSchema
  | ProductSchema;

// SchemaInput union type - used in composables
export type SchemaInput =
  | ArticleSchemaInput
  | OrganizationSchemaInput
  | BreadcrumbSchemaInput
  | WebPageSchemaInput
  | WebSiteSchemaInput
  | ProductSchemaInput;