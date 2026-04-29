# Technical Design: cms-enhancement

## Change: cms-enhancement
## Date: 2026-04-21
## Author: SDD Design Phase

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Nuxt)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  nuxt.config.ts                                                             │
│    ├── ssr: true (static generation)                                        │
│    ├── routeRules: CMS routes → prerender                                    │
│    ├── i18n: dynamic locales from backend                                   │
│    ├── @nuxtjs/robots: robots.txt + meta                                    │
│    └── @nuxtjs/sitemap: sitemap with hreflang                               │
│                                                                             │
│  modules/cms/                                                               │
│    ├── composables/                                                         │
│    │   ├── useCmsBlogPosts.ts       (enhanced with categoryId, tags)        │
│    │   ├── useCmsCategories.ts      (unchanged)                             │
│    │   └── useSchema.ts             (NEW: JSON-LD factory registry)          │
│    └── components/                                                          │
│        ├── SchemaOrg.vue            (NEW: renders JSON-LD script)           │
│        └── SeoMeta.vue              (NEW: robots + hreflang)               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ API (REST)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (NestJS)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  modules/cms/                                                               │
│    ├── seo/                                                                 │
│    │   ├── infrastructure/                                                 │
│    │   │   ├── entities/seo-metadata.entity.ts   (ENHANCED)                  │
│    │   │   │     + robotsPolicy: jsonb                                   │
│    │   │   │     + hreflangEnabled: boolean                              │
│    │   │   │     + hreflangAlternateLocales: string[]                     │
│    │   │   │     + hreflangCustomUrls: jsonb                             │
│    │   │   └── schemas/json-ld.schema.ts       (REFACTORED → factory)      │
│    │   │         ├── JsonLdSchemaFactory.ts    (NEW: registry + factories) │
│    │   │         └── types.ts                  (NEW: schema interfaces)    │
│    │   └── seo.service.ts, seo.controller.ts   (ENHANCED)                   │
│    │                                                                         │
│    └── blog/                                                                │
│        ├── posts/                                                          │
│        │   ├── infrastructure/entities/blog-post.entity.ts  (ENHANCED)       │
│        │   │     + categoryId: uuid (FK → blog_category.id)                │
│        │   │     + tags: simple-array (DEPRECATED, migration only)          │
│        │   │     + category: ManyToOne → BlogCategoryEntity               │
│        │   │     + postTags: ManyToMany → PostTagEntity (via blog_post_tag) │
│        │   │                                                              │
│        │   ├── dto/create-post.dto.ts    (ENHANCED: categoryId, tagIds)     │
│        │   ├── dto/update-post.dto.ts    (ENHANCED)                         │
│        │   ├── posts.service.ts          (ENHANCED)                         │
│        │   └── posts.controller.ts       (ENHANCED: ?categoryId filter)    │
│        │                                                                  │
│        └── categories/                                                      │
│            └── infrastructure/entities/blog-category.entity.ts  (ENHANCED)  │
│                  + posts: OneToMany → BlogPostEntity                       │
│                                                                             │
│    NEW: post-tag.entity.ts          (standalone tag entity)                  │
│    NEW: blog-post-tag.entity.ts      (join table entity)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (PostgreSQL)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  blog_post          — +categoryId (FK), tags (simple-array, deprecated)      │
│  blog_category      — unchanged (posts relation added via FK)                │
│  post_tag           — NEW: id, name (unique), createdAt, updatedAt           │
│  blog_post_tag      — NEW: postId (FK), tagId (FK), PRIMARY KEY (postId,tagId│
│  seo_metadata       — +robotsPolicy (jsonb), hreflangEnabled,                │
│                      hreflangAlternateLocales, hreflangCustomUrls           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Model Changes

### 2.1 SeoMetadataEntity Enhancements

**File:** `apps/back/src/modules/cms/seo/infrastructure/entities/seo-metadata.entity.ts`

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';

// Robots Policy Interface
export interface RobotsPolicy {
  index?: boolean;                // default: true
  follow?: boolean;               // default: true
  maxImagePreview?: 'none' | 'small' | 'large';
  maxVideoPreview?: 'none' | 'small' | 'large' | number;
  maxSnippet?: 'none' | number;
  noArchive?: boolean;
  noTranslate?: boolean;
}

@Entity({ name: 'seo_metadata' })
export class SeoMetadataEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  pageId: string;

  @Index()
  @Column({ type: 'String', length: 10 })
  lang: string;

  @Column({ type: 'String', length: 70, nullable: true })
  metaTitle: string | null;

  @Column({ type: 'String', length: 160, nullable: true })
  metaDescription: string | null;

  @Column({ type: 'simple-array', nullable: true })
  metaKeywords: string[] | null;

  @ManyToOne(() => FileEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ogImageId' })
  ogImage?: FileEntity | null;

  @Column({ type: 'uuid', nullable: true })
  ogImageId?: string | null;

  @Column({ type: 'String', nullable: true })
  canonicalUrl: string | null;

  @Column({ type: 'String', length: 70, nullable: true })
  ogTitle: string | null;

  @Column({ type: 'String', length: 200, nullable: true })
  ogDescription: string | null;

  @Column({ type: 'jsonb', nullable: true })
  customJsonLd: Record<string, any> | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  type?: 'WebPage' | 'Article' | 'WebSite';

  // === NEW FIELDS ===

  @Column({ type: 'jsonb', nullable: true })
  robotsPolicy: RobotsPolicy | null;

  @Column({ type: 'boolean', default: true })
  hreflangEnabled: boolean;

  @Column({ type: 'simple-array', nullable: true })
  hreflangAlternateLocales: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  hreflangCustomUrls: Record<string, string> | null;

  // === END NEW FIELDS ===

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

**Migration column additions:**
```sql
ALTER TABLE seo_metadata ADD COLUMN robotsPolicy jsonb;
ALTER TABLE seo_metadata ADD COLUMN hreflangEnabled boolean NOT NULL DEFAULT true;
ALTER TABLE seo_metadata ADD COLUMN hreflangAlternateLocales simple-array;
ALTER TABLE seo_metadata ADD COLUMN hreflangCustomUrls jsonb;
```

---

### 2.2 PostTagEntity (NEW)

**File:** `apps/back/src/modules/cms/blog/posts/infrastructure/entities/post-tag.entity.ts`

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { BlogPostEntity } from './blog-post.entity';

@Entity({ name: 'post_tag' })
export class PostTagEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'String' })
  name: string;

  @ManyToMany(() => BlogPostEntity, (post) => post.postTags)
  posts: BlogPostEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

**Migration:**
```sql
CREATE TABLE post_tag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp
);
CREATE UNIQUE INDEX idx_post_tag_name ON post_tag (name) WHERE deleted_at IS NULL;
```

---

### 2.3 BlogPostTagJoinEntity (Join Table Entity)

**File:** `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post-tag.entity.ts`

```typescript
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryColumn,
  JoinColumn,
} from 'typeorm';
import { BlogPostEntity } from './blog-post.entity';
import { PostTagEntity } from './post-tag.entity';

@Entity({ name: 'blog_post_tag' })
export class BlogPostTagEntity {
  @PrimaryColumn({ type: 'uuid', name: 'post_id' })
  postId: string;

  @PrimaryColumn({ type: 'uuid', name: 'tag_id' })
  tagId: string;

  @ManyToOne(() => BlogPostEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: BlogPostEntity;

  @ManyToOne(() => PostTagEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag: PostTagEntity;
}
```

**Migration:**
```sql
CREATE TABLE blog_post_tag (
  post_id uuid NOT NULL REFERENCES blog_post(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES post_tag(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX idx_blog_post_tag_tag ON blog_post_tag (tag_id);
```

---

### 2.4 BlogPostEntity Enhancements

**File:** `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post.entity.ts`

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';
import { UserEntity } from '@users/infrastructure/entities/user.entity';
import { BlogCategoryEntity } from '@cms/blog/categories/infrastructure/entities/blog-category.entity';
import { PostTagEntity } from './post-tag.entity';

@Entity({ name: 'blog_post' })
export class BlogPostEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'String' })
  slug: string;

  // DEPRECATED: simple-array tags — preserved for migration, use postTags instead
  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ type: 'boolean', default: false })
  isPublished: boolean;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @ManyToOne(() => FileEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'featuredImageId' })
  featuredImage?: FileEntity | null;

  @Column({ type: 'uuid', nullable: true })
  featuredImageId?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author?: UserEntity | null;

  @Column({ type: 'int', nullable: true })
  authorId?: number | null;

  // === NEW RELATIONS ===

  @ManyToOne(() => BlogCategoryEntity, (category) => category.posts, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'categoryId' })
  category?: BlogCategoryEntity | null;

  @Column({ type: 'uuid', nullable: true })
  categoryId?: string | null;

  @ManyToMany(() => PostTagEntity, (tag) => tag.posts, { cascade: true })
  @JoinTable({
    name: 'blog_post_tag',
    joinColumn: { name: 'post_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  postTags: PostTagEntity[];

  // === END NEW RELATIONS ===

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

**Migration column addition:**
```sql
ALTER TABLE blog_post ADD COLUMN categoryId uuid REFERENCES blog_category(id) ON DELETE SET NULL;
CREATE INDEX idx_blog_post_category ON blog_post (categoryId) WHERE categoryId IS NOT NULL;
```

---

### 2.5 BlogCategoryEntity Enhancements

**File:** `apps/back/src/modules/cms/blog/categories/infrastructure/entities/blog-category.entity.ts`

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { BlogPostEntity } from '@cms/blog/posts/infrastructure/entities/blog-post.entity';

@Entity({ name: 'blog_category' })
export class BlogCategoryEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'String' })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => BlogCategoryEntity, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parentId' })
  parent?: BlogCategoryEntity | null;

  @OneToMany(() => BlogCategoryEntity, (category) => category.parent)
  children?: BlogCategoryEntity[];

  // === NEW RELATION ===
  @OneToMany(() => BlogPostEntity, (post) => post.category)
  posts: BlogPostEntity[];
  // === END NEW RELATION ===

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

---

## 3. JSON-LD Schema Factory System

### 3.1 TypeScript Interfaces

**File:** `apps/back/src/modules/cms/seo/infrastructure/schemas/types.ts`

```typescript
// Base schema types
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
}

// Product schema (placeholder for future)
export interface ProductSchema extends JsonLdSchema {
  '@type': 'Product';
  name: string;
  description: string;
  image?: string;
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

// Schema type union
export type SchemaType = 'Article' | 'Organization' | 'BreadcrumbList' | 'WebPage' | 'WebSite' | 'Product';

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
}

export interface ProductSchemaInput {
  name: string;
  description: string;
  image?: string;
  offers?: OfferSchema;
}
```

---

### 3.2 Schema Factories

**File:** `apps/back/src/modules/cms/seo/infrastructure/schemas/json-ld.factories.ts`

```typescript
import type {
  ArticleSchemaInput,
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

const APP_URL = process.env.APP_URL || 'https://example.com';

// Article factory
export function createArticleSchema(input: ArticleSchemaInput): ArticleSchema {
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
    url: `${APP_URL}/blog/${input.slug}`,
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
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.metaTitle,
    description: input.metaDescription,
    url: `${APP_URL}/${input.slug}`,
  };
}

// WebSite factory
export function createWebSiteSchema(input: WebSiteSchemaInput): WebSiteSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: input.name,
    url: input.url,
  };
}

// Product factory (placeholder)
export function createProductSchema(input: ProductSchemaInput): ProductSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    image: input.image,
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
```

---

### 3.3 Schema Registry

**File:** `apps/back/src/modules/cms/seo/infrastructure/schemas/json-ld.registry.ts`

```typescript
import type { SchemaType } from './types';
import { createArticleSchema, type ArticleSchemaInput } from './json-ld.factories';
import { createOrganizationSchema, type OrganizationSchemaInput } from './json-ld.factories';
import { createBreadcrumbSchema, type BreadcrumbSchemaInput } from './json-ld.factories';
import { createWebPageSchema, type WebPageSchemaInput } from './json-ld.factories';
import { createWebSiteSchema, type WebSiteSchemaInput } from './json-ld.factories';
import { createProductSchema, type ProductSchemaInput } from './json-ld.factories';
import type { JsonLdSchema } from './types';

// Factory function type
type SchemaFactory<T> = (input: T) => JsonLdSchema;

// Registry entry
interface SchemaFactoryEntry {
  factory: SchemaFactory<any>;
  inputType: string;
}

// Schema registry map
const schemaRegistry: Record<SchemaType, SchemaFactoryEntry> = {
  Article: {
    factory: createArticleSchema as SchemaFactory<any>,
    inputType: 'ArticleSchemaInput',
  },
  Organization: {
    factory: createOrganizationSchema as SchemaFactory<any>,
    inputType: 'OrganizationSchemaInput',
  },
  BreadcrumbList: {
    factory: createBreadcrumbSchema as SchemaFactory<any>,
    inputType: 'BreadcrumbSchemaInput',
  },
  WebPage: {
    factory: createWebPageSchema as SchemaFactory<any>,
    inputType: 'WebPageSchemaInput',
  },
  WebSite: {
    factory: createWebSiteSchema as SchemaFactory<any>,
    inputType: 'WebSiteSchemaInput',
  },
  Product: {
    factory: createProductSchema as SchemaFactory<any>,
    inputType: 'ProductSchemaInput',
  },
};

// Registry class
export class JsonLdSchemaRegistry {
  private static instance: JsonLdSchemaRegistry;
  private factories: Map<SchemaType, SchemaFactoryEntry>;

  private constructor() {
    this.factories = new Map(Object.entries(schemaRegistry));
  }

  static getInstance(): JsonLdSchemaRegistry {
    if (!JsonLdSchemaRegistry.instance) {
      JsonLdSchemaRegistry.instance = new JsonLdSchemaRegistry();
    }
    return JsonLdSchemaRegistry.instance;
  }

  // Get factory for schema type
  getFactory(type: SchemaType): SchemaFactoryEntry | undefined {
    return this.factories.get(type);
  }

  // Check if type is registered
  has(type: SchemaType): boolean {
    return this.factories.has(type);
  }

  // Get all registered types
  getRegisteredTypes(): SchemaType[] {
    return Array.from(this.factories.keys()) as SchemaType[];
  }

  // Register new schema type (extensibility)
  register<T>(type: SchemaType, factory: SchemaFactory<T>): void {
    this.factories.set(type, {
      factory: factory as SchemaFactory<any>,
      inputType: 'unknown',
    });
  }

  // Generate schema by type (main entry point)
  generate<T extends Record<string, any>>(
    type: SchemaType,
    input: T,
  ): JsonLdSchema | null {
    const entry = this.factories.get(type);
    if (!entry) {
      return null;
    }
    return entry.factory(input);
  }
}

// Export convenience functions
export const schemaRegistry = JsonLdSchemaRegistry.getInstance();

export function generateSchema<T extends Record<string, any>>(
  type: SchemaType,
  input: T,
): JsonLdSchema | null {
  return schemaRegistry.generate(type, input);
}
```

---

### 3.4 Refactored SEO Service

**File:** `apps/back/src/modules/cms/seo/seo.service.ts` (refactored)

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeoMetadataEntity } from './infrastructure/entities/seo-metadata.entity';
import { UpdateSeoDto } from './dto/update-seo.dto';
import { schemaRegistry } from './infrastructure/schemas/json-ld.registry';
import type { SchemaType } from './infrastructure/schemas/types';

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);

  constructor(
    @InjectRepository(SeoMetadataEntity)
    private readonly seoRepository: Repository<SeoMetadataEntity>,
  ) {}

  async findByPageId(
    pageId: string,
    lang: string,
  ): Promise<SeoMetadataEntity | null> {
    return this.seoRepository.findOne({
      where: { pageId, lang },
      relations: ['ogImage'],
    });
  }

  async upsert(
    pageId: string,
    lang: string,
    updateSeoDto: UpdateSeoDto,
  ): Promise<SeoMetadataEntity> {
    let seo = await this.findByPageId(pageId, lang);

    if (seo) {
      Object.assign(seo, updateSeoDto);
    } else {
      seo = this.seoRepository.create({
        pageId,
        lang,
        ...updateSeoDto,
      });
    }

    // Generate JSON-LD schema if type is provided
    if (updateSeoDto.type) {
      seo.customJsonLd = await this.generateJsonLd(
        { slug: pageId },
        seo,
        updateSeoDto.type,
      );
    }

    return this.seoRepository.save(seo);
  }

  async generateJsonLd(
    entity: { slug: string; publishedAt?: Date | null },
    seo: SeoMetadataEntity,
    type: 'WebPage' | 'Article' | 'WebSite',
    author?: string,
  ): Promise<Record<string, any>> {
    // Use registry to generate schema
    const schemaInput = {
      slug: entity.slug,
      publishedAt: entity.publishedAt,
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
      ogImage: seo.ogImage
        ? { url: `${process.env.APP_URL}/${seo.ogImage.path}` }
        : null,
      author,
    };

    const schema = schemaRegistry.generate(type as SchemaType, schemaInput);
    return schema || { '@context': 'https://schema.org', '@type': 'WebPage' };
  }

  async delete(pageId: string, lang: string): Promise<void> {
    const seo = await this.findByPageId(pageId, lang);
    if (seo) {
      await this.seoRepository.remove(seo);
    }
  }
}
```

---

## 4. API Contract

### 4.1 Modified: UpdateSeoDto

**File:** `apps/back/src/modules/cms/seo/dto/update-seo.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsArray, IsEnum, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

// Robots Policy DTO
class RobotsPolicyDto {
  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  index?: boolean;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  follow?: boolean;

  @ApiPropertyOptional({ enum: ['none', 'small', 'large'] })
  @IsOptional()
  @IsString()
  maxImagePreview?: 'none' | 'small' | 'large';

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  maxVideoPreview?: 'none' | 'small' | 'large';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maxSnippet?: 'none' | string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  noArchive?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  noTranslate?: boolean;
}

export class UpdateSeoDto {
  @ApiPropertyOptional({ type: String, maxLength: 70 })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({ type: String, maxLength: 160 })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  metaKeywords?: string[];

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  canonicalUrl?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  ogTitle?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  ogDescription?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  ogImageId?: string;

  @ApiPropertyOptional({ enum: ['WebPage', 'Article', 'WebSite'] })
  @IsOptional()
  @IsEnum(['WebPage', 'Article', 'WebSite'])
  type?: 'WebPage' | 'Article' | 'WebSite';

  // === NEW FIELDS ===

  @ApiPropertyOptional({ type: RobotsPolicyDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RobotsPolicyDto)
  robotsPolicy?: RobotsPolicyDto;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  hreflangEnabled?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  hreflangAlternateLocales?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  hreflangCustomUrls?: Record<string, string>;

  // === END NEW FIELDS ===
}
```

---

### 4.2 Modified: CreateBlogPostDto

**File:** `apps/back/src/modules/cms/blog/posts/dto/create-post.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
} from 'class-validator';

export class CreateBlogPostDto {
  @ApiProperty({ example: 'my-first-post', type: String })
  @IsNotEmpty()
  @IsString()
  slug: string;

  // Deprecated: use tagIds instead
  @ApiPropertyOptional({ example: ['tech', 'news'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  featuredImageId?: string;

  // === NEW FIELDS ===

  @ApiPropertyOptional({ type: String, description: 'Category UUID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Array of Tag UUIDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  // === END NEW FIELDS ===
}
```

---

### 4.3 Modified: UpdateBlogPostDto

**File:** `apps/back/src/modules/cms/blog/posts/dto/update-post.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateBlogPostDto } from './create-post.dto';

export class UpdateBlogPostDto extends PartialType(CreateBlogPostDto) {}
```

---

### 4.4 Modified: BlogPostsService

**File:** `apps/back/src/modules/cms/blog/posts/posts.service.ts`

Key changes:
1. `findAll` and `findAllPublished` include `category` relation
2. New method `findByCategory(categoryId)` for filtering by category
3. `create` and `update` handle `categoryId` and `tagIds`
4. Tag upsert logic: create tags that don't exist

```typescript
@Injectable()
export class BlogPostsService {
  private readonly logger = new Logger(BlogPostsService.name);

  constructor(
    @InjectRepository(BlogPostEntity)
    private readonly blogPostRepository: Repository<BlogPostEntity>,
    @InjectRepository(PostTagEntity)
    private readonly tagRepository: Repository<PostTagEntity>,
    private readonly filesService: FilesService,
  ) {}

  // ... existing methods ...

  async findAll(query: FindAllBlogPostDto & { categoryId?: string }) {
    const { page = 1, limit = 10, published, categoryId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (published !== undefined) {
      where.isPublished = published;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [data, total] = await this.blogPostRepository.findAndCount({
      where,
      order: { publishedAt: 'DESC', createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['featuredImage', 'author', 'category', 'postTags'],
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByCategory(categoryId: string, page = 1, limit = 10) {
    return this.findAll({ page, limit, published: true, categoryId });
  }

  async create(createPostDto: CreateBlogPostDto): Promise<BlogPostEntity> {
    const { categoryId, tagIds, tags: _tags, ...postData } = createPostDto;

    // Create post without relations first
    const post = this.blogPostRepository.create(postData);

    // Handle category
    if (categoryId) {
      post.categoryId = categoryId;
    }

    // Handle tags (upsert logic)
    if (tagIds && tagIds.length > 0) {
      const tags = await this.tagRepository.findBy({ id: In(tagIds) });
      post.postTags = tags;
    }

    return this.blogPostRepository.save(post);
  }

  async update(
    id: string,
    updatePostDto: UpdateBlogPostDto,
  ): Promise<BlogPostEntity> {
    const { categoryId, tagIds, tags: _tags, ...postData } = updatePostDto;
    const post = await this.findById(id);

    // Update basic fields
    Object.assign(post, postData);

    // Handle category
    if (categoryId !== undefined) {
      post.categoryId = categoryId;
    }

    // Handle tags
    if (tagIds !== undefined) {
      if (tagIds.length > 0) {
        const tags = await this.tagRepository.findBy({ id: In(tagIds) });
        post.postTags = tags;
      } else {
        post.postTags = [];
      }
    }

    return this.blogPostRepository.save(post);
  }
}
```

---

### 4.5 New: BlogPostsController Endpoint

**File:** `apps/back/src/modules/cms/blog/posts/posts.controller.ts`

Add new endpoint for category filtering:

```typescript
@ApiTags('CMS Blog Posts')
@Controller({ path: 'cms/blog/posts', version: '1' })
export class BlogPostsController {
  constructor(private readonly blogPostsService: BlogPostsService) {}

  // ... existing endpoints ...

  @Get('public/category/:categoryId')
  @HttpCode(HttpStatus.OK)
  findByCategory(
    @Param('categoryId') categoryId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.blogPostsService.findByCategory(categoryId, page, limit);
  }
}
```

---

## 5. Frontend Architecture

### 5.1 Nuxt Config Changes

**File:** `apps/front/nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  extends: ['./modules/landing', './modules/base', './modules/cms'],
  devtools: { enabled: true },
  ssr: true, // CHANGED: enable SSR for static generation

  // ... existing alias, runtimeConfig, modules config ...

  routeRules: {
    // Admin routes - no prerender
    '/app/cms/**': { ssr: false },

    // Public CMS routes - prerender at build time
    '/[lang]/page/**': { prerender: true },
    '/[lang]/pages': { prerender: true },
    '/[lang]/blog': { prerender: true },
    '/[lang]/blog/**': { prerender: true },
    '/[lang]/category/**': { prerender: true },
  },

  // nuxt-seo module configuration
  sitemap: {
    sources: ['/api/sitemap/blog', '/api/sitemap/cms-pages'],
    xsl: true,
    defaults: {
      type: 'website',
    },
  },

  // Robots module
  robots: {
    UserAgent: '*',
    Disallow: ['/app/cms/', '/api/'],
    Allow: '/',
    Sitemap: '/sitemap.xml',
  },
});
```

---

### 5.2 JSON-LD Schema Composable

**File:** `apps/front/modules/cms/composables/useSchema.ts`

```typescript
import type {
  ArticleSchemaInput,
  OrganizationSchemaInput,
  BreadcrumbSchemaInput,
  ProductSchemaInput,
} from './types'; // shared types between front/back

export type SchemaType = 'Article' | 'Organization' | 'BreadcrumbList' | 'Product';

interface JsonLdSchema {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: unknown;
}

const APP_URL = import.meta.env.APP_URL || 'https://example.com';

// Schema factories (mirror backend factories)
function createArticleSchema(input: ArticleSchemaInput): JsonLdSchema {
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
    url: `${APP_URL}/blog/${input.slug}`,
  };
}

function createBreadcrumbSchema(input: BreadcrumbSchemaInput): JsonLdSchema {
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

function createOrganizationSchema(input: OrganizationSchemaInput): JsonLdSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    url: input.url,
    logo: input.logo,
  };
}

// Schema registry
const factories: Record<SchemaType, (input: any) => JsonLdSchema> = {
  Article: createArticleSchema,
  BreadcrumbList: createBreadcrumbSchema,
  Organization: createOrganizationSchema,
  Product: () => ({ '@context': 'https://schema.org', '@type': 'Product' }), // placeholder
};

export function useSchema() {
  const schemas = ref<JsonLdSchema[]>([]);

  // Add a schema to the document
  function addSchema(type: SchemaType, input: any) {
    const factory = factories[type];
    if (factory) {
      schemas.value.push(factory(input));
    }
  }

  // Remove all schemas
  function clearSchemas() {
    schemas.value = [];
  }

  // Remove schemas of a specific type
  function removeSchema(type: SchemaType) {
    schemas.value = schemas.value.filter((s) => s['@type'] !== type);
  }

  // Get all schemas as JSON string
  function getSchemasJson(): string {
    return JSON.stringify(schemas.value);
  }

  return {
    schemas,
    addSchema,
    clearSchemas,
    removeSchema,
    getSchemasJson,
  };
}
```

---

### 5.3 SeoMeta Component

**File:** `apps/front/modules/cms/components/SeoMeta.vue`

```vue
<script setup lang="ts">
interface RobotsPolicy {
  index?: boolean;
  follow?: boolean;
  maxImagePreview?: 'none' | 'small' | 'large';
  noArchive?: boolean;
  noTranslate?: boolean;
}

interface Props {
  pageId: string;
  lang?: string;
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: { url: string };
  robotsPolicy?: RobotsPolicy;
  hreflangEnabled?: boolean;
  hreflangAlternateLocales?: string[];
  hreflangCustomUrls?: Record<string, string>;
  type?: 'WebPage' | 'Article' | 'WebSite';
}

const props = withDefaults(defineProps<Props>(), {
  lang: 'es',
  hreflangEnabled: true,
});

const { t } = useI18n();
const config = useRuntimeConfig();
const appUrl = config.public.appUrl || window.location.origin;

// Generate robots meta content
const robotsContent = computed(() => {
  const policy = props.robotsPolicy;
  if (!policy) return null;

  const parts: string[] = [];
  if (policy.index === false) parts.push('noindex');
  else parts.push('index');

  if (policy.follow === false) parts.push('nofollow');
  else parts.push('follow');

  if (policy.maxImagePreview) parts.push(`max-image-preview:${policy.maxImagePreview}`);
  if (policy.noArchive) parts.push('noarchive');
  if (policy.noTranslate) parts.push('notranslate');

  return parts.join(', ');
});

// Generate hreflang links
const hreflangLinks = computed(() => {
  if (props.hreflangEnabled === false) return [];

  const locales = props.hreflangAlternateLocales || ['en', 'es'];
  const currentPath = props.canonicalUrl || useRequestURL().pathname;

  return locales.map((locale) => {
    const customUrl = props.hreflangCustomUrls?.[locale];
    const url = customUrl || `${appUrl}/${locale}${currentPath}`;
    return {
      rel: 'alternate',
      hreflang: locale,
      href: url,
    };
  });
});

// x-default hreflang
const xDefaultLink = computed(() => {
  if (props.hreflangEnabled === false) return null;
  const currentPath = props.canonicalUrl || useRequestURL().pathname;
  return {
    rel: 'alternate',
    hreflang: 'x-default',
    href: `${appUrl}/${props.lang}${currentPath}`,
  };
});
</script>

<template>
  <div>
    <!-- Robots meta -->
    <meta
      v-if="robotsContent"
      name="robots"
      :content="robotsContent"
    />

    <!-- Canonical URL -->
    <link
      v-if="canonicalUrl"
      rel="canonical"
      :href="canonicalUrl"
    />

    <!-- Hreflang links -->
    <template v-if="hreflangEnabled">
      <link
        v-for="link in hreflangLinks"
        :key="link.hreflang"
        :rel="link.rel"
        :hreflang="link.hreflang"
        :href="link.href"
      />
      <link
        v-if="xDefaultLink"
        :rel="xDefaultLink.rel"
        hreflang="x-default"
        :href="xDefaultLink.href"
      />
    </template>
  </div>
</template>
```

---

### 5.4 SchemaOrg Component

**File:** `apps/front/modules/cms/components/SchemaOrg.vue`

```vue
<script setup lang="ts">
interface Props {
  schemas: Array<{
    '@context': string;
    '@type': string;
    [key: string]: unknown;
  }>;
}

const props = defineProps<Props>();

const schemasJson = computed(() => {
  return JSON.stringify(props.schemas);
});
</script>

<template>
  <component
    :is="'script'"
    type="application/ld+json"
    v-html="schemasJson"
  />
</template>
```

---

### 5.5 Enhanced useCmsBlogPosts

**File:** `apps/front/modules/cms/composables/useCmsBlogPosts.ts`

Key changes:
1. `CmsBlogPost` interface includes `categoryId` and `tagIds`
2. New `fetchPostsByCategory` method
3. `fetchPost` returns category and tags relations

```typescript
export interface CmsBlogPost {
  id: string;
  slug: string;
  author: string;
  categoryId: string | null;
  categoryName?: string;
  tagIds: string[];        // NEW
  tags: string[];           // DEPRECATED: from simple-array
  isPublished: boolean;
  publishedAt: string | null;
  featuredImage?: {
    id: string;
    url: string;
    name: string;
  };
}

export interface CmsBlogPostWithTranslations extends CmsBlogPost {
  translations: {
    title: string;
    content: string;
    excerpt: string;
  };
  seo: {
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string[];
    ogImage?: { url: string };
    robotsPolicy?: RobotsPolicy;     // NEW
    hreflangEnabled?: boolean;       // NEW
    hreflangAlternateLocales?: string[]; // NEW
    hreflangCustomUrls?: Record<string, string>; // NEW
  };
}

export function useCmsBlogPosts() {
  const posts = ref<CmsBlogPost[]>([]);
  const currentPost = ref<CmsBlogPostWithTranslations | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ... existing methods ...

  // NEW: Fetch posts by category
  const fetchPostsByCategory = async (
    categoryId: string,
    query: { page?: number; limit?: number } = {},
  ) => {
    loading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      params.append('categoryId', categoryId);
      if (query.page) params.append('page', String(query.page));
      if (query.limit) params.append('limit', String(query.limit));
      params.append('published', 'true');

      const result = await fetchWrapper.get(
        `${baseUrl}/cms/blog/posts?${params}`,
      );
      posts.value = result.data || result;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error fetching posts';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // ... rest of existing methods ...

  return {
    posts,
    currentPost,
    loading,
    error,
    fetchPosts,
    fetchPostsByCategory,  // NEW
    // ... existing exports ...
  };
}
```

---

### 5.6 nuxt-seo + i18n Integration

**File:** `apps/front/modules/cms/composables/useSeo.ts` (NEW)

```typescript
import type { RobotsPolicy } from './types';

export function useSeo() {
  const config = useRuntimeConfig();
  const { locale, locales } = useI18n();
  const appUrl = config.public.appUrl || window.location.origin;

  // Get active locales from i18n
  const activeLocales = computed(() => {
    return (locales.value as Array<{ code: string }>).map((l) => l.code);
  });

  // Build hreflang links for current page
  function buildHreflangLinks(currentPath: string, customUrls?: Record<string, string>) {
    return activeLocales.value.map((loc) => {
      const customUrl = customUrls?.[loc];
      return {
        rel: 'alternate',
        hreflang: loc,
        href: customUrl || `${appUrl}/${loc}${currentPath}`,
      };
    });
  }

  // Build robots content string
  function buildRobotsContent(policy?: RobotsPolicy): string | null {
    if (!policy) return null;

    const parts: string[] = [];
    parts.push(policy.index === false ? 'noindex' : 'index');
    parts.push(policy.follow === false ? 'nofollow' : 'follow');

    if (policy.maxImagePreview) {
      parts.push(`max-image-preview:${policy.maxImagePreview}`);
    }
    if (policy.noArchive) parts.push('noarchive');
    if (policy.noTranslate) parts.push('notranslate');

    return parts.join(', ');
  }

  return {
    activeLocales,
    buildHreflangLinks,
    buildRobotsContent,
  };
}
```

---

## 6. SSG Configuration

### 6.1 Prerender Configuration

**File:** `apps/front/nuxt.config.ts` (SSG section)

```typescript
export default defineNuxtConfig({
  // ... existing config ...

  routeRules: {
    // Admin routes - no prerender (client-side only)
    '/app/cms/**': { ssr: false },

    // Public routes - prerender at build time
    '/[lang]/page/**': { prerender: true },
    '/[lang]/pages': { prerender: true },
    '/[lang]/blog': { prerender: true },
    '/[lang]/blog/**': { prerender: true },
    '/[lang]/category/**': { prerender: true },

    // Fallback: generate on demand if not prerendered
    '/**': { prerender: false },
  },

  // Crawl links from these starting paths
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/es', '/en'],
    },
  },
});
```

---

### 6.2 Sitemap Integration

**File:** `apps/front/nuxt.config.ts`

```typescript
// Add localized URLs to sitemap
sitemap: {
  sources: ['/api/sitemap/blog', '/api/sitemap/cms-pages'],
  urls: {
    // Dynamic hreflang for each sitemap entry
    each: (entry) => {
      return ['es', 'en'].map((lang) => ({
        loc: entry.loc.replace(/^\//, `/${lang}/`),
        hreflang: lang,
      }));
    },
  },
},
```

---

## 7. Migration Strategy

### 7.1 Migration Files

**File:** `apps/back/src/migrations/{timestamp}-cms-enhancement.ts`

```typescript
import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CmsEnhancement1700000000000 implements MigrationInterface {
  name = 'CmsEnhancement1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add columns to seo_metadata
    await queryRunner.addColumn(
      'seo_metadata',
      new TableColumn({
        name: 'robotsPolicy',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'seo_metadata',
      new TableColumn({
        name: 'hreflangEnabled',
        type: 'boolean',
        default: true,
      }),
    );

    await queryRunner.addColumn(
      'seo_metadata',
      new TableColumn({
        name: 'hreflangAlternateLocales',
        type: 'simple-array',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'seo_metadata',
      new TableColumn({
        name: 'hreflangCustomUrls',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    // 2. Add categoryId to blog_post
    await queryRunner.addColumn(
      'blog_post',
      new TableColumn({
        name: 'categoryId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Create index on categoryId
    await queryRunner.createIndex(
      'blog_post',
      new TableIndex({
        name: 'idx_blog_post_category',
        columnNames: ['categoryId'],
      }),
    );

    // Add FK constraint
    await queryRunner.createForeignKey(
      'blog_post',
      new TableForeignKey({
        name: 'fk_blog_post_category',
        columnNames: ['categoryId'],
        referencedTableName: 'blog_category',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // 3. Create post_tag table
    await queryRunner.createTable(
      new Table({
        name: 'post_tag',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create index on name
    await queryRunner.createIndex(
      'post_tag',
      new TableIndex({
        name: 'idx_post_tag_name',
        columnNames: ['name'],
        where: 'deleted_at IS NULL',
      }),
    );

    // 4. Create blog_post_tag join table
    await queryRunner.createTable(
      new Table({
        name: 'blog_post_tag',
        columns: [
          {
            name: 'post_id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'tag_id',
            type: 'uuid',
            isPrimary: true,
          },
        ],
      }),
      true,
    );

    // Create indexes on join table
    await queryRunner.createIndex(
      'blog_post_tag',
      new TableIndex({
        name: 'idx_blog_post_tag_tag',
        columnNames: ['tag_id'],
      }),
    );

    // Add FK constraints
    await queryRunner.createForeignKey(
      'blog_post_tag',
      new TableForeignKey({
        name: 'fk_blog_post_tag_post',
        columnNames: ['post_id'],
        referencedTableName: 'blog_post',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'blog_post_tag',
      new TableForeignKey({
        name: 'fk_blog_post_tag_tag',
        columnNames: ['tag_id'],
        referencedTableName: 'post_tag',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 5. Migrate existing tags from simple-array to post_tag table
    // This is a data migration step
    await queryRunner.query(`
      INSERT INTO post_tag (id, name, "createdAt", "updatedAt")
      SELECT
        gen_random_uuid(),
        unnest(tags),
        NOW(),
        NOW()
      FROM blog_post
      WHERE tags IS NOT NULL
      AND cardinality(tags) > 0
      ON CONFLICT (name) DO NOTHING;
    `);

    // Link existing tags to posts via join table
    await queryRunner.query(`
      INSERT INTO blog_post_tag (post_id, tag_id)
      SELECT bp.id, pt.id
      FROM blog_post bp
      CROSS JOIN LATERAL unnest(bp.tags) AS tag_name
      JOIN post_tag pt ON pt.name = tag_name
      WHERE bp.tags IS NOT NULL
      AND cardinality(bp.tags) > 0
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop FK constraints
    await queryRunner.dropForeignKey('blog_post_tag', 'fk_blog_post_tag_tag');
    await queryRunner.dropForeignKey('blog_post_tag', 'fk_blog_post_tag_post');
    await queryRunner.dropForeignKey('blog_post', 'fk_blog_post_category');

    // Drop indexes
    await queryRunner.dropIndex('blog_post_tag', 'idx_blog_post_tag_tag');
    await queryRunner.dropIndex('blog_post', 'idx_blog_post_category');
    await queryRunner.dropIndex('post_tag', 'idx_post_tag_name');

    // Drop tables
    await queryRunner.dropTable('blog_post_tag');
    await queryRunner.dropTable('post_tag');

    // Drop columns from blog_post
    await queryRunner.dropColumn('blog_post', 'categoryId');

    // Drop columns from seo_metadata
    await queryRunner.dropColumn('seo_metadata', 'hreflangCustomUrls');
    await queryRunner.dropColumn('seo_metadata', 'hreflangAlternateLocales');
    await queryRunner.dropColumn('seo_metadata', 'hreflangEnabled');
    await queryRunner.dropColumn('seo_metadata', 'robotsPolicy');
  }
}
```

---

## 8. File Map

### 8.1 Backend Files

| Action | File Path | Description |
|--------|-----------|-------------|
| **MODIFY** | `apps/back/src/modules/cms/seo/infrastructure/entities/seo-metadata.entity.ts` | Add robotsPolicy, hreflang fields |
| **CREATE** | `apps/back/src/modules/cms/seo/infrastructure/schemas/types.ts` | TypeScript interfaces for JSON-LD schemas |
| **CREATE** | `apps/back/src/modules/cms/seo/infrastructure/schemas/json-ld.factories.ts` | Schema factory functions |
| **CREATE** | `apps/back/src/modules/cms/seo/infrastructure/schemas/json-ld.registry.ts` | Schema registry + `generateSchema()` |
| **DELETE** | `apps/back/src/modules/cms/seo/infrastructure/schemas/json-ld.schema.ts` | Old monolithic schema file |
| **MODIFY** | `apps/back/src/modules/cms/seo/dto/update-seo.dto.ts` | Add robotsPolicy DTO, hreflang fields |
| **MODIFY** | `apps/back/src/modules/cms/seo/seo.service.ts` | Use schema registry instead of switch |
| **CREATE** | `apps/back/src/modules/cms/blog/posts/infrastructure/entities/post-tag.entity.ts` | New PostTagEntity |
| **CREATE** | `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post-tag.entity.ts` | Join table entity |
| **MODIFY** | `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post.entity.ts` | Add categoryId FK, postTags relation |
| **MODIFY** | `apps/back/src/modules/cms/blog/categories/infrastructure/entities/blog-category.entity.ts` | Add posts OneToMany |
| **MODIFY** | `apps/back/src/modules/cms/blog/posts/dto/create-post.dto.ts` | Add categoryId, tagIds |
| **MODIFY** | `apps/back/src/modules/cms/blog/posts/dto/update-post.dto.ts` | Add categoryId, tagIds |
| **MODIFY** | `apps/back/src/modules/cms/blog/posts/posts.service.ts` | Handle relations, tag upsert, category filter |
| **MODIFY** | `apps/back/src/modules/cms/blog/posts/posts.controller.ts` | Add `public/category/:categoryId` endpoint |
| **CREATE** | `apps/back/src/migrations/{timestamp}-cms-enhancement.ts` | Migration for all schema changes |

### 8.2 Frontend Files

| Action | File Path | Description |
|--------|-----------|-------------|
| **CREATE** | `apps/front/modules/cms/composables/useSchema.ts` | JSON-LD schema factory + registry composable |
| **CREATE** | `apps/front/modules/cms/composables/useSeo.ts` | SEO helpers (hreflang, robots) |
| **CREATE** | `apps/front/modules/cms/components/SchemaOrg.vue` | Renders JSON-LD script tag |
| **CREATE** | `apps/front/modules/cms/components/SeoMeta.vue` | Robots meta, hreflang links, canonical |
| **CREATE** | `apps/front/modules/cms/types/seo.types.ts` | Shared SEO types (RobotsPolicy, etc.) |
| **CREATE** | `apps/front/modules/cms/types/json-ld.types.ts` | Shared JSON-LD types |
| **MODIFY** | `apps/front/modules/cms/composables/useCmsBlogPosts.ts` | Add categoryId, tagIds, fetchPostsByCategory |
| **MODIFY** | `apps/front/nuxt.config.ts` | Enable SSR, add prerender rules |

---

## 9. Implementation Order

1. **Migration first** — Run migration to add columns/tables
2. **Backend entities** — Create PostTagEntity, BlogPostTagEntity, update BlogPostEntity, BlogCategoryEntity
3. **Backend DTOs** — Update CreateBlogPostDto, UpdateBlogPostDto, UpdateSeoDto
4. **JSON-LD factory** — Create types.ts, factories, registry
5. **Backend services** — Update BlogPostsService (relations, tags), SeoService (registry)
6. **Backend controllers** — Add category filter endpoint
7. **Frontend types** — Create shared types
8. **Frontend composables** — Create useSchema, useSeo
9. **Frontend components** — Create SchemaOrg.vue, SeoMeta.vue
10. **Frontend composables update** — Enhance useCmsBlogPosts
11. **nuxt.config.ts** — Enable SSR + prerender rules
12. **Test** — Verify all features work together

---

## 10. Backward Compatibility Notes

1. **tags (simple-array)** — Preserved in BlogPostEntity for migration. Code should migrate to use `postTags` relation.
2. **SeoMetadataEntity fields** — All new fields are nullable with sensible defaults. Existing records work without changes.
3. **API endpoints** — All existing endpoints unchanged. New `categoryId` and `tagIds` fields are optional.
4. **Frontend composables** — Existing `useCmsBlogPosts` returns unchanged shape for existing fields. New fields are additive.
