# Tasks: cms-enhancement

## Change: cms-enhancement
## Project: foundation
## Artifact Store: hybrid

---

## Phase 1: Database Migration
- [x] **T1**: Generate TypeORM migration for all schema changes (depends: none)

**Files:**
- Create: `apps/back/src/migrations/{timestamp}-cms-enhancement.ts`

**Migration must include:**
- Add `robotsPolicy` (jsonb), `hreflangEnabled` (bool default true), `hreflangAlternateLocales` (simple-array), `hreflangCustomUrls` (jsonb) to `seo_metadata`
- Add `categoryId` (uuid FK → blog_category.id) to `blog_post` with index
- Create `post_tag` table (id, name unique, createdAt, updatedAt, deletedAt)
- Create `blog_post_tag` join table (postId, tagId PKs with FKs + CASCADE)
- Migrate existing simple-array `tags` from `blog_post` → `post_tag` → `blog_post_tag`

---

## Phase 2: Backend Entities

### T2: Create PostTagEntity (depends: T1)
- [x] **T2**: COMPLETED
- Create: `apps/back/src/modules/cms/blog/posts/infrastructure/entities/post-tag.entity.ts`

```typescript
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

### T3: Create BlogPostTagEntity (join table) (depends: T1)
- [x] **T3**: COMPLETED
- Create: `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post-tag.entity.ts`

```typescript
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

### T4: Update BlogPostEntity (depends: T1, T2, T3)
- [x] **T4**: COMPLETED
- Modify: `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post.entity.ts`

**Changes:**
- Keep existing `tags: string[]` (simple-array, deprecated, for migration)
- Add `categoryId: string | null` column (nullable uuid)
- Add `@ManyToOne(() => BlogCategoryEntity, ...)` category relation
- Add `@ManyToMany(() => PostTagEntity, ...)` postTags relation with `@JoinTable({ name: 'blog_post_tag' })`
- Add `category?: BlogCategoryEntity | null` and `postTags: PostTagEntity[]` properties

### T5: Update SeoMetadataEntity (depends: T1)
- [x] **T5**: COMPLETED
- Modify: `apps/back/src/modules/cms/seo/infrastructure/entities/seo-metadata.entity.ts`

**Changes:**
- Add `RobotsPolicy` interface (index, follow, maxImagePreview, maxVideoPreview, maxSnippet, noArchive, noTranslate)
- Add `robotsPolicy: RobotsPolicy | null` (jsonb, nullable)
- Add `hreflangEnabled: boolean` (default: true)
- Add `hreflangAlternateLocales: string[] | null` (simple-array, nullable)
- Add `hreflangCustomUrls: Record<string, string> | null` (jsonb, nullable)

### T6: Update BlogCategoryEntity (depends: T1)
- [x] **T6**: COMPLETED
- Modify: `apps/back/src/modules/cms/blog/categories/infrastructure/entities/blog-category.entity.ts`

**Changes:**
- Add `@OneToMany(() => BlogPostEntity, (post) => post.category)` posts relation
- Add `posts: BlogPostEntity[]` property

---

## Phase 3: Backend DTOs

### T7: Update UpdateSeoDto (depends: T5)
- [x] **T7**: COMPLETED
**Files:**
- Modify: `apps/back/src/modules/cms/seo/dto/update-seo.dto.ts`

**Changes:**
- Add `RobotsPolicyDto` class with all optional fields (index, follow, maxImagePreview, maxVideoPreview, maxSnippet, noArchive, noTranslate)
- Add `robotsPolicy?: RobotsPolicyDto` property with validation
- Add `hreflangEnabled?: boolean` property
- Add `hreflangAlternateLocales?: string[]` property
- Add `hreflangCustomUrls?: Record<string, string>` property

### T8: Update CreateBlogPostDto (depends: T4)
- [x] **T8**: COMPLETED
**Files:**
- Modify: `apps/back/src/modules/cms/blog/posts/dto/create-post.dto.ts`

**Changes:**
- Add `categoryId?: string` (optional UUID)
- Add `tagIds?: string[]` (optional array of UUIDs)
- Keep existing `tags?: string[]` as deprecated

### T9: Update UpdateBlogPostDto (depends: T8)
- [x] **T9**: COMPLETED
**Files:**
- Modify: `apps/back/src/modules/cms/blog/posts/dto/update-post.dto.ts`

**Changes:**
- Uses `PartialType(CreateBlogPostDto)` — no direct changes needed if CreateBlogPostDto is updated

---

## Phase 4: JSON-LD Schema System

### T10: Create JSON-LD types (depends: T5)
- [x] **T10**: COMPLETED
**Files:**
- Create: `apps/back/src/modules/cms/seo/infrastructure/schemas/types.ts`

**Contents:**
- `JsonLdSchema` base interface
- `ArticleSchema`, `OrganizationSchema`, `BreadcrumbListSchema`, `WebPageSchema`, `WebSiteSchema`, `ProductSchema`, `OfferSchema`, `PersonSchema` interfaces
- `SchemaType` union type
- All input types: `ArticleSchemaInput`, `OrganizationSchemaInput`, `BreadcrumbSchemaInput`, `WebPageSchemaInput`, `WebSiteSchemaInput`, `ProductSchemaInput`

### T11: Create JSON-LD factories (depends: T10)
- [x] **T11**: COMPLETED
**Files:**
- Create: `apps/back/src/modules/cms/seo/infrastructure/schemas/json-ld.factories.ts`

**Functions:**
- `createArticleSchema(input: ArticleSchemaInput): ArticleSchema`
- `createOrganizationSchema(input: OrganizationSchemaInput): OrganizationSchema`
- `createBreadcrumbSchema(input: BreadcrumbSchemaInput): BreadcrumbListSchema`
- `createWebPageSchema(input: WebPageSchemaInput): WebPageSchema`
- `createWebSiteSchema(input: WebSiteSchemaInput): WebSiteSchema`
- `createProductSchema(input: ProductSchemaInput): ProductSchema`

### T12: Create JSON-LD registry (depends: T11)
- [x] **T12**: COMPLETED
**Files:**
- Create: `apps/back/src/modules/cms/seo/infrastructure/schemas/json-ld.registry.ts`

**Contents:**
- `JsonLdSchemaRegistry` singleton class with:
  - `factories: Map<SchemaType, SchemaFactoryEntry>`
  - `getFactory(type: SchemaType): SchemaFactoryEntry | undefined`
  - `has(type: SchemaType): boolean`
  - `getRegisteredTypes(): SchemaType[]`
  - `register<T>(type: SchemaType, factory: SchemaFactory<T>): void`
  - `generate<T>(type: SchemaType, input: T): JsonLdSchema | null`
- Export `schemaRegistry` singleton instance
- Export `generateSchema(type, input)` convenience function

### T13: Delete old JSON-LD schema file (depends: T12)
- [x] **T13**: COMPLETED
**Files:**
- Delete: `apps/back/src/modules/cms/seo/infrastructure/schemas/json-ld.schema.ts`

---

## Phase 5: Backend Services

### T14: Update SeoService (depends: T12)
- [x] **T14**: COMPLETED
**Files:**
- Modify: `apps/back/src/modules/cms/seo/seo.service.ts`

**Changes:**
- Import `schemaRegistry` from `./infrastructure/schemas/json-ld.registry`
- Replace inline JSON-LD switch logic with `schemaRegistry.generate(type, input)`
- Update `generateJsonLd` method to use registry
- Add proper typing with `SchemaType` from types.ts
- Add `generatePageSchema(pageId, lang)` method
- Add `generateOrganizationSchema(config)` method
- Add `generateBreadcrumbSchema(pathSegments)` method

### T15: Update BlogPostsService (depends: T2, T3, T4, T8, T9)
- [x] **T15**: COMPLETED
**Files:**
- Modify: `apps/back/src/modules/cms/blog/posts/posts.service.ts`

**Changes:**
- Add `@InjectRepository(PostTagEntity)` in constructor
- Update `findAll` and `findAllPublished` to include `category` and `postTags` relations
- Add `findByCategory(categoryId, page?, limit?)` method
- Update `create` method: extract `categoryId` and `tagIds`, handle categoryId assignment, handle tag upsert via `tagIds`
- Update `update` method: handle `categoryId` and `tagIds` changes, clear tags if empty array
- Add proper `In` import from TypeORM for tag lookup

---

## Phase 6: Backend Controllers

### T16: Update BlogPostsController (depends: T15)
- [x] **T16**: COMPLETED
**Files:**
- Modify: `apps/back/src/modules/cms/blog/posts/posts.controller.ts`

**Changes:**
- Add `@Get('public/category/:categoryId')` endpoint
- Handler: `findByCategory(@Param('categoryId') categoryId: string, @Query('page') page: number = 1, @Query('limit') limit: number = 10)`
- Returns: `this.blogPostsService.findByCategory(categoryId, page, limit)`

---

## Phase 7: Frontend Types

### T17: Create SEO types (depends: none)
- [x] **T17**: COMPLETED
**Files:**
- Create: `apps/front/modules/cms/types/seo.ts`

**Contents:**
- `RobotsPolicy` interface
- `HreflangLink` interface
- `SeoMetadata` interface

### T18: Create JSON-LD types (depends: none)
- [x] **T18**: COMPLETED
**Files:**
- Create: `apps/front/modules/cms/types/json-ld.ts`

**Contents:**
- `JsonLdSchema` base interface
- `ArticleSchemaInput`, `OrganizationSchemaInput`, `BreadcrumbSchemaInput` interfaces
- `SchemaType` union type ('Article' | 'Organization' | 'BreadcrumbList' | 'Product')

---

## Phase 8: Frontend Composables

### T19: Create useSchema composable (depends: T18)
- [x] **T19**: COMPLETED
**Files:**
- Create: `apps/front/modules/cms/composables/useSchema.ts`
- Create: `apps/front/modules/cms/utils/json-ld.ts` (factory functions)

**Implementation:**
- Mirror backend factory functions (Article, BreadcrumbList, Organization, Product)
- `useSchema()` returns: `{ schemas, addSchema, clearSchemas, removeSchema, getSchemasJson }`
- `addSchema(type: SchemaType, input: any)` — generates schema and pushes to array
- `clearSchemas()` — empties array
- `removeSchema(type: SchemaType)` — filters by @type
- `getSchemasJson()` — returns `JSON.stringify(schemas)`

### T20: Create useSeo composable (depends: T17)
- [x] **T20**: COMPLETED
**Files:**
- Create: `apps/front/modules/cms/composables/useSeo.ts`

**Implementation:**
- `activeLocales` — computed from `useI18n().locales`
- `buildHreflangLinks(currentPath: string, customUrls?: Record<string, string>)` — returns array of `{ rel, hreflang, href }`
- `buildRobotsContent(policy?: RobotsPolicy)` — returns string like "index,follow,noarchive"
- `setSeoMeta(seo: SeoMetadata)` — calls `useHead()` to set all SEO meta

### T21: Update useCmsBlogPosts (depends: T17)
- [x] **T21**: COMPLETED
**Files:**
- Modify: `apps/front/modules/cms/composables/useCmsBlogPosts.ts`

**Changes:**
- Update `CmsBlogPost` interface: add `categoryId: string | null`, `categoryName?: string`, `tagIds: string[]`
- Update `CmsBlogPostWithTranslations` interface: add `robotsPolicy`, `hreflangEnabled`, `hreflangAlternateLocales`, `hreflangCustomUrls` to seo
- Add `fetchPostsByCategory(categoryId: string, query?: { page?, limit? })` method
- Update return to include `fetchPostsByCategory`

---

## Phase 9: Frontend Components

### T22: Create SchemaOrg component (depends: T19)
- [x] **T22**: COMPLETED
**Files:**
- Create: `apps/front/modules/cms/components/SchemaOrg.vue`

**Implementation:**
- Props: `schemas: Array<JsonLdSchema>`
- Uses `useHead()` to inject JSON-LD script tags
- Handles empty schemas case (renders nothing)
- Maps schemas to script tags with proper type

### T23: Create SeoMeta component (depends: T17, T20)
- [x] **T23**: COMPLETED
**Files:**
- Modify: `apps/front/modules/cms/components/cms/CmsSeoMeta.vue`

**Implementation:**
- Enhanced existing CmsSeoMeta component
- Added robots meta tag support with `buildRobotsContent()` logic
- Added hreflang alternate link tags via `buildHreflangLinks()` logic
- Added canonical URL support
- Kept all existing OG tags, Twitter cards, JSON-LD
- Uses `useHead()` for all SEO meta injection

---

## Phase 10: Nuxt Configuration

### T24: Update nuxt.config.ts (depends: T22, T23)
- [x] **T24**: COMPLETED
**Files:**
- Modify: `apps/front/nuxt.config.ts`

**Changes:**
- Changed `ssr: false` → `ssr: true` (enabled for SSG)
- Updated `routeRules`:
  - Admin routes: `/app/cms/**`: `{ ssr: false }`
  - Public routes: `prerender: true` for CMS pages, blog, categories
  - Fallback: `/**`: `{ prerender: false }`
- Added `nitro.prerender.crawlLinks: true` with routes `['/', '/es', '/en']`
- Enhanced `sitemap` config with hreflang URLs
- Added `robots` config with UserAgent, Disallow, Allow, Sitemap

---

## Phase 11: Verification

### T25: Verify implementation (depends: all previous)
**Verification checklist:**
- [ ] Migration runs without errors
- [ ] PostTagEntity CRUD works via API
- [ ] BlogPost can be created with categoryId and tagIds
- [ ] Posts can be filtered by category via `/public/category/:categoryId`
- [ ] SeoMetadata can store robotsPolicy, hreflangEnabled, hreflangAlternateLocales, hreflangCustomUrls
- [ ] JSON-LD schemas are generated correctly for Article, BreadcrumbList, Organization types
- [ ] Frontend useSchema composable generates valid JSON-LD
- [ ] Frontend SeoMeta component renders correct robots and hreflang tags
- [ ] SSG prerender works for CMS routes (`nuxt generate` produces static HTML)
- [ ] Sitemap includes hreflang for localized routes

---

## Task Dependency Summary

```
T1 (Migration)
  ├─ T2 (PostTagEntity)
  ├─ T3 (BlogPostTagEntity)
  ├─ T4 (BlogPostEntity) ────┐
  ├─ T5 (SeoMetadataEntity)  │     These can run in parallel
  └─ T6 (BlogCategoryEntity) │
          │
          ├─ T7 (UpdateSeoDto)
          ├─ T8 (CreateBlogPostDto)
          └─ T9 (UpdateBlogPostDto)
                  │
          ┌───────┴────────────────┐
          │                       │
          ▼                       ▼
    T10 (JSON-LD types)    T14 (SeoService)
          │                       │
          ▼                       │
    T11 (JSON-LD factories)       │
          │                       │
          ▼                       │
    T12 (JSON-LD registry)        │
          │                       │
          ▼                       │
    T13 (Delete old schema)       │
                                  │
          ┌───────────────────────┘
          │
          ▼
    T15 (BlogPostsService)
          │
          ▼
    T16 (BlogPostsController)
          │
    ┌─────┴─────┐
    ▼           ▼
T17 (SEO    T18 (JSON-LD
 types)     types)
    │           │
    └─────┬─────┘
          │
    ┌─────┴─────┐
    ▼           ▼
T19 (useSchema)  T20 (useSeo)
    │           │
    │           ▼
    │    T21 (useCmsBlogPosts update)
    │           │
    │           ▼
    └─────┬─────┘
          │
    ┌─────┴─────┐
    ▼           ▼
T22 (SchemaOrg) T23 (SeoMeta)
          │
          └───────────┐
                      ▼
                T24 (nuxt.config)
                      │
                      ▼
                T25 (Verification)
```

---

## Files by Phase

### Phase 1
- `apps/back/src/migrations/{timestamp}-cms-enhancement.ts` (CREATE)

### Phase 2
- `apps/back/src/modules/cms/blog/posts/infrastructure/entities/post-tag.entity.ts` (CREATE)
- `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post-tag.entity.ts` (CREATE)
- `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post.entity.ts` (MODIFY)
- `apps/back/src/modules/cms/seo/infrastructure/entities/seo-metadata.entity.ts` (MODIFY)
- `apps/back/src/modules/cms/blog/categories/infrastructure/entities/blog-category.entity.ts` (MODIFY)

### Phase 3
- `apps/back/src/modules/cms/seo/dto/update-seo.dto.ts` (MODIFY)
- `apps/back/src/modules/cms/blog/posts/dto/create-post.dto.ts` (MODIFY)
- `apps/back/src/modules/cms/blog/posts/dto/update-post.dto.ts` (MODIFY)

### Phase 4
- `apps/back/src/modules/cms/seo/infrastructure/schemas/types.ts` (CREATE)
- `apps/back/src/modules/cms/seo/infrastructure/schemas/json-ld.factories.ts` (CREATE)
- `apps/back/src/modules/cms/seo/infrastructure/schemas/json-ld.registry.ts` (CREATE)
- `apps/back/src/modules/cms/seo/infrastructure/schemas/json-ld.schema.ts` (DELETE)

### Phase 5
- `apps/back/src/modules/cms/seo/seo.service.ts` (MODIFY)
- `apps/back/src/modules/cms/blog/posts/posts.service.ts` (MODIFY)

### Phase 6
- `apps/back/src/modules/cms/blog/posts/posts.controller.ts` (MODIFY)

### Phase 7
- `apps/front/modules/cms/types/seo.types.ts` (CREATE)
- `apps/front/modules/cms/types/json-ld.types.ts` (CREATE)

### Phase 8
- `apps/front/modules/cms/composables/useSchema.ts` (CREATE)
- `apps/front/modules/cms/composables/useSeo.ts` (CREATE)
- `apps/front/modules/cms/composables/useCmsBlogPosts.ts` (MODIFY)

### Phase 9
- `apps/front/modules/cms/components/SchemaOrg.vue` (CREATE)
- `apps/front/modules/cms/components/SeoMeta.vue` (CREATE)

### Phase 10
- `apps/front/nuxt.config.ts` (MODIFY)
