// Base JSON-LD schema interface
export interface JsonLdSchema {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: unknown;
}

// Article schema
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

// Organization schema
export interface OrganizationSchema extends JsonLdSchema {
  '@type': 'Organization';
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
}

// BreadcrumbList schema
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

// WebPage schema
export interface WebPageSchema extends JsonLdSchema {
  '@type': 'WebPage';
  name?: string;
  description?: string;
  url: string;
}

// WebSite schema
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

// Product schema
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

// BlogPosting schema
export interface BlogPostingSchema extends JsonLdSchema {
  '@type': 'BlogPosting';
  headline: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: PersonSchema;
  url: string;
  publisher?: OrganizationSchema;
  mainEntityOfPage?: string;
}

// Schema type union
export type SchemaType =
  | 'Article'
  | 'BlogPosting'
  | 'BreadcrumbList'
  | 'Organization'
  | 'WebPage'
  | 'WebSite'
  | 'Product';

// Factory input types
export interface ArticleSchemaInput {
  slug: string;
  publishedAt?: Date | null;
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

export interface BlogPostingSchemaInput {
  slug: string;
  publishedAt?: Date | null;
  metaTitle: string;
  metaDescription?: string;
  ogImage?: { url: string } | null;
  author?: string;
  publisherName?: string;
  publisherLogo?: string;
}

// SchemaInput mapped type
export type SchemaInput =
  | ArticleSchemaInput
  | BlogPostingSchemaInput
  | OrganizationSchemaInput
  | BreadcrumbSchemaInput
  | WebPageSchemaInput
  | WebSiteSchemaInput
  | ProductSchemaInput;
