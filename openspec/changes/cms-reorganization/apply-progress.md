# Apply Progress: CMS Reorganization

## Completed Tasks (Batch 1)

### Phase 1: Additive Migrations & Config
- [x] 1.1 Add `section` varchar column to `page` table (migration)
- [x] 1.2 Add `category` varchar nullable column to `translation` table (migration)
- [x] 1.3 Add `slug` varchar unique column to `post_tag` table (migration)
- [x] 1.4 Add `cdnBaseUrl` to `app.config.ts` and `app-config.type.ts`
- [x] 1.5 Verify: `categoryId` on `blog_post`, `post_tag` table, and `blog_post_tag` join table already exist from migration `1776766884245-CmsEnhancementSchema` — do NOT recreate

### Phase 2: Backend Entities & DTOs
- [x] 2.1 `PageEntity`: add `section` enum (`landing`/`blog`/`documentation`/`store`), keep `template` property temporarily
- [x] 2.2 `BlogPostEntity`: rename `postTags` relation to `tags`, keep legacy `tags` simple-array temporarily
- [x] 2.3 `PostTagEntity`: rename class to `TagEntity` (keep `@Entity({ name: 'post_tag' })`), add `slug` column
- [x] 2.4 `TranslationEntity`: add `category` column
- [x] 2.5 `CreatePageDto`: replace `template` with `section`, add `name` for slug generation
- [x] 2.6 `CreateBlogPostDto`: remove `tags` string[], keep `tagIds`
- [x] 2.7 `CreateBlogCategoryDto`: remove `description`, auto-generate slug from `name`
- [x] 2.8 `UpdateCategoryDto`: remove `description` field
- [x] 2.9 Create `CreateTagDto` and `UpdateTagDto` with `name`, `slug`

### Phase 3: Backend Services & Controllers
- [x] 3.1 Create `TagsService` with CRUD, slug uniqueness enforcement, soft-delete, and `name` translation support (`entityName: "Tag"`)
- [x] 3.2 Create `TagsController` exposing `GET/POST/PATCH/DELETE /cms/tags`
- [x] 3.3 Update `PagesService`: auto-generate slug from `name` when not provided; handle `section`; ignore `order` on create
- [x] 3.4 Update `BlogCategoriesService`: hydrate `description` from translations on read; persist `description` as translation on write/update
- [x] 3.5 Update `BlogPostsService`: add `uploadFeaturedImage(postId, file)` using `FilesS3Service` + `cdnBaseUrl`
- [x] 3.6 Update `BlogPostsController`: wire `POST /:id/featured-image`; ensure `GET /:id/preview` returns hydrated data for unpublished posts
- [x] 3.7 Update `TranslationsService`: allow `entityName` filter without requiring `entityId`

## Deviations & Notes

### Task 2.2 — Naming Conflict Resolution
The instruction to keep the legacy `tags` simple-array while renaming the `postTags` relation to `tags` created a TypeScript name collision (two properties cannot share the same name). To resolve this while preserving both fields as required, the legacy simple-array was temporarily renamed to `tagNames` in `BlogPostEntity`. This allows the relation to assume the canonical `tags` name immediately. The `tagNames` column will be dropped in Phase 5.

### Task 3.4 — Category Description DTOs
The `description` field was added back to `CreateBlogCategoryDto` and `UpdateCategoryDto` as optional, because without it the service could not receive description data from the API to persist as translations. This is a necessary correction to make the translation persistence feature functional.

### Task 3.6 — Preview Endpoint Enhancement
The preview endpoint now returns a structured object with `id`, `slug`, `title`, `content`, `featuredImage`, `isPublished`, `publishedAt`, `tags`, and `category` instead of the raw entity. This provides hydrated preview data for unpublished posts as required by the spec.

### Phase 4: Data Backfill Migrations
- [x] 4.1 Map `page.template` values to `page.section` (`landing`→`landing`, `generic`→`blog`, `contact`→`store`)
- [x] 4.2 Migrate `blog_category.description` values into `translation` rows (`entityName: "Category"`, `key: "description"`, `lang: "es"`)
- [x] 4.3 Populate `post_tag.slug` from existing `name` values (kebab-case)

## Deviations & Notes

### Task 2.2 — Naming Conflict Resolution
The instruction to keep the legacy `tags` simple-array while renaming the `postTags` relation to `tags` created a TypeScript name collision (two properties cannot share the same name). To resolve this while preserving both fields as required, the legacy simple-array was temporarily renamed to `tagNames` in `BlogPostEntity`. This allows the relation to assume the canonical `tags` name immediately. The `tagNames` column will be dropped in Phase 5.

### Task 3.4 — Category Description DTOs
The `description` field was added back to `CreateBlogCategoryDto` and `UpdateCategoryDto` as optional, because without it the service could not receive description data from the API to persist as translations. This is a necessary correction to make the translation persistence feature functional.

### Task 3.6 — Preview Endpoint Enhancement
The preview endpoint now returns a structured object with `id`, `slug`, `title`, `content`, `featuredImage`, `isPublished`, `publishedAt`, `tags`, and `category` instead of the raw entity. This provides hydrated preview data for unpublished posts as required by the spec.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/back/src/infrastructure/database/migrations/1776766884246-AddSectionToPage.ts` | Created | Migration adding `section` to `page` table |
| `apps/back/src/infrastructure/database/migrations/1776766884247-AddCategoryToTranslation.ts` | Created | Migration adding `category` to `translation` table |
| `apps/back/src/infrastructure/database/migrations/1776766884248-AddSlugToPostTag.ts` | Created | Migration adding `slug` to `post_tag` table with partial unique index |
| `apps/back/src/config/app.config.ts` | Modified | Added `CDN_BASE_URL` env var and `cdnBaseUrl` config field (falls back to `BUNNY_CDN_URL`) |
| `apps/back/src/config/app-config.type.ts` | Modified | Added `cdnBaseUrl?: string` to `AppConfig` type |
| `apps/back/src/modules/cms/pages/infrastructure/entities/page.entity.ts` | Modified | Added `PageSection` enum and `section` column; kept `template` |
| `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post.entity.ts` | Modified | Renamed relation `postTags` → `tags`; renamed simple-array `tags` → `tagNames` |
| `apps/back/src/modules/cms/blog/posts/infrastructure/entities/post-tag.entity.ts` | Modified | Renamed class `PostTagEntity` → `TagEntity`; added `slug` column |
| `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post-tag.entity.ts` | Modified | Updated imports/references to `TagEntity` |
| `apps/back/src/modules/translations/infrastructure/entities/translation.entity.ts` | Modified | Added `category` column |
| `apps/back/src/modules/cms/pages/dto/create-page.dto.ts` | Modified | Replaced `template` with `section`; added `name` |
| `apps/back/src/modules/cms/blog/posts/dto/create-post.dto.ts` | Modified | Removed `tags` string[] array |
| `apps/back/src/modules/cms/blog/categories/dto/create-category.dto.ts` | Modified | Removed `description`; made `slug` optional |
| `apps/back/src/modules/cms/blog/categories/dto/update-category.dto.ts` | Modified | Removed `description` field |
| `apps/back/src/modules/cms/blog/posts/dto/create-tag.dto.ts` | Created | DTO for tag creation |
| `apps/back/src/modules/cms/blog/posts/dto/update-tag.dto.ts` | Created | DTO for tag update (extends `PartialType(CreateTagDto)`) |
| `apps/back/src/modules/cms/blog/posts/posts.service.ts` | Modified | Updated all references from `PostTagEntity`/`postTags` to `TagEntity`/`tags`; updated simple-array references to `tagNames` |
| `apps/back/src/modules/cms/blog/blog.module.ts` | Modified | Updated `PostTagEntity` → `TagEntity` in TypeOrmModule.forFeature |
| `apps/back/src/infrastructure/utils/slugify.ts` | Created | Simple kebab-case slugify utility |
| `apps/back/src/modules/cms/blog/posts/dto/find-all-tag.dto.ts` | Created | Pagination DTO for tag listing |
| `apps/back/src/modules/cms/blog/tags/tags.service.ts` | Created | Tag CRUD with slug uniqueness, soft-delete, and name translation support |
| `apps/back/src/modules/cms/blog/tags/tags.controller.ts` | Created | REST endpoints for tag management under `/cms/tags` |
| `apps/back/src/modules/cms/pages/pages.service.ts` | Modified | Auto-generates slug from `name`; ignores `order` on create |
| `apps/back/src/modules/cms/blog/categories/categories.service.ts` | Modified | Hydrates `description` from translations; persists `description` as translation; auto-generates slug from `name` |
| `apps/back/src/modules/cms/blog/categories/dto/create-category.dto.ts` | Modified | Added optional `description` field back |
| `apps/back/src/modules/cms/blog/categories/dto/update-category.dto.ts` | Modified | Added optional `description` field back |
| `apps/back/src/modules/cms/blog/posts/posts.service.ts` | Modified | Added `uploadFeaturedImage` using `FILE_UPLOADER_SERVICE` + `cdnBaseUrl` |
| `apps/back/src/modules/cms/blog/posts/posts.controller.ts` | Modified | Added `POST /:id/featured-image` endpoint; enhanced `GET /:id/preview` with hydrated response |
| `apps/back/src/modules/translations/translations.service.ts` | Modified | Allow `entityName` filter without requiring `entityId` |
| `apps/back/src/modules/cms/blog/blog.module.ts` | Modified | Added `TagsController`, `TagsService`, and `TranslationsModule` imports/exports |
| `apps/back/src/infrastructure/database/migrations/1776766884249-MapPageTemplateToSection.ts` | Created | Data backfill: maps `page.template` → `page.section` with `template_backup` column for rollback |
| `apps/back/src/infrastructure/database/migrations/1776766884250-MigrateCategoryDescriptionToTranslations.ts` | Created | Data backfill: migrates `blog_category.description` to `translation` rows (lang: es) |
| `apps/back/src/infrastructure/database/migrations/1776766884251-PopulatePostTagSlug.ts` | Created | Data backfill: populates `post_tag.slug` from `name` with duplicate handling |
| `openspec/changes/cms-reorganization/tasks.md` | Modified | Marked Phase 1, 2, 3 & 4 tasks complete |
| `openspec/changes/cms-reorganization/apply-progress.md` | Modified | Updated with Batch 3 progress |

### Phase 5: Destructive Migrations & Entity Cleanup (Batch 4)
- [x] 5.1 Drop `template` column from `page` table (idempotent via `IF EXISTS`)
- [x] 5.2 Drop `tagNames` simple-array column from `blog_post` table (idempotent via `IF EXISTS`)
- [x] 5.3 Drop `description` column from `blog_category` table (idempotent via `IF EXISTS`, verifies translation count before dropping)
- [x] 5.4 `PageEntity`: removed `template` property and `PageTemplate` enum
- [x] 5.5 `BlogPostEntity`: removed legacy `tagNames` simple-array property
- [x] 5.6 `BlogCategoryEntity`: removed `description` property
- [x] 5.7 `BlogPostsService`: removed all `tagNames` backward-compatibility assignments in `create()` and `update()`

## Files Changed (Batch 4)

| File | Action | Description |
|------|--------|-------------|
| `apps/back/src/infrastructure/database/migrations/1776766884252-DropPageTemplateColumn.ts` | Created | Destructive migration: drops `template` and `template_backup` from `page` table |
| `apps/back/src/infrastructure/database/migrations/1776766884253-DropBlogPostTagNamesColumn.ts` | Created | Destructive migration: drops `tagNames` from `blog_post` table |
| `apps/back/src/infrastructure/database/migrations/1776766884254-DropBlogCategoryDescriptionColumn.ts` | Created | Destructive migration: drops `description` from `blog_category` table |
| `apps/back/src/modules/cms/pages/infrastructure/entities/page.entity.ts` | Modified | Removed `PageTemplate` enum and `template` column property |
| `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post.entity.ts` | Modified | Removed legacy `tagNames` simple-array property |
| `apps/back/src/modules/cms/blog/categories/infrastructure/entities/blog-category.entity.ts` | Modified | Removed `description` column property |
| `apps/back/src/modules/cms/blog/posts/posts.service.ts` | Modified | Removed `tagNames` backward-compatibility code from `create()` and `update()` |
| `openspec/changes/cms-reorganization/tasks.md` | Modified | Marked Phase 5 tasks complete |
| `openspec/changes/cms-reorganization/apply-progress.md` | Modified | Updated with Batch 4 progress |

### Phase 7: Tests (Batch 6 Retry)
- [x] 7.1 Unit tests — `apps/back/src/modules/cms/pages/pages.service.spec.ts` (slug auto-generation, section handling, CRUD)
- [x] 7.2 Unit tests — `apps/back/src/modules/cms/blog/categories/categories.service.spec.ts` (description hydration/persistence as translation, CRUD)
- [x] 7.3 Integration tests — `apps/back/test/integration/cms-tags.e2e-spec.ts` (Tag CRUD endpoints + public category filter)
- [x] 7.4 Integration tests — `apps/back/test/integration/cms-blog-posts.e2e-spec.ts` (preview hydrated data, featured-image upload)

## Files Changed (Batch 6)

| File | Action | Description |
|------|--------|-------------|
| `apps/back/src/modules/cms/pages/pages.service.spec.ts` | Created | Unit tests for PagesService: slug auto-generation from `name`, `section` handling, create/update/find/remove |
| `apps/back/src/modules/cms/blog/categories/categories.service.spec.ts` | Created | Unit tests for BlogCategoriesService: description hydration from translations, description persistence as translation, tree building, circular reference guards |
| `apps/back/test/integration/cms-tags.e2e-spec.ts` | Created | Integration tests for Tag CRUD endpoints (`POST/GET/PATCH/DELETE /cms/tags`) and public category filter endpoint |
| `apps/back/test/integration/cms-blog-posts.e2e-spec.ts` | Created | Integration tests for blog post preview (`GET /cms/blog/posts/:id/preview`) and featured image upload (`POST /cms/blog/posts/:id/featured-image`) |

## Fix Batch (Post-Verify Blockers)

### Fixes Applied
- [x] **Translation `category` field API exposure**: Added `category` to `CreateTranslationDto` and `UpdateTranslationDto`; updated `TranslationsService.createTranslation()` and `findAllTranslationsWithPagination()` to accept/persist/filter by `category`; updated `TranslationsController.findAllTranslations()` to pass `category` filter.
- [x] **Linter fixes**: Removed unused imports (`ApiProperty`, `IsEnum` from `update-category.dto.ts`; `IsArray` from `create-page.dto.ts`; `Column` from `blog-post-tag.entity.ts`); fixed floating promises in `pages.controller.spec.ts` by making test callbacks async and awaiting controller calls.

### Files Changed (Fix Batch)

| File | Action | Description |
|------|--------|-------------|
| `apps/back/src/modules/translations/dto/create-translation.dto.ts` | Modified | Added optional `category?: string` field with `@ApiProperty`, `@IsString`, `@IsOptional` |
| `apps/back/src/modules/translations/translations.service.ts` | Modified | Accept `category` in `createTranslation()` and persist it; add `category` filter to `findAllTranslationsWithPagination()` query builder |
| `apps/back/src/modules/translations/translations.controller.ts` | Modified | Pass `filter?.category` to `findAllTranslationsWithPagination()` |
| `apps/back/src/modules/cms/blog/categories/dto/update-category.dto.ts` | Modified | Removed unused `ApiProperty` and `IsEnum` imports |
| `apps/back/src/modules/cms/pages/dto/create-page.dto.ts` | Modified | Removed unused `IsArray` import |
| `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post-tag.entity.ts` | Modified | Removed unused `Column` import |
| `apps/back/src/modules/cms/pages/pages.controller.spec.ts` | Modified | Fixed floating promises: made test callbacks async, used `mockResolvedValue`/`mockRejectedValue`, awaited controller calls and `expect().rejects.toThrow()` |
