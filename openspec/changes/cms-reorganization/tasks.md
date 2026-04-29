# Tasks: CMS Reorganization

## Phase 1: Additive Migrations & Config

- [x] 1.1 Add `section` varchar column to `page` table (migration)
- [x] 1.2 Add `category` varchar nullable column to `translation` table (migration)
- [x] 1.3 Add `slug` varchar unique column to `post_tag` table (migration)
- [x] 1.4 Add `cdnBaseUrl` to `app.config.ts` and `app-config.type.ts`
- [x] 1.5 Verify: `categoryId` on `blog_post`, `post_tag` table, and `blog_post_tag` join table already exist from migration `1776766884245-CmsEnhancementSchema` — do NOT recreate

## Phase 2: Backend Entities & DTOs

- [x] 2.1 `PageEntity`: add `section` enum (`landing`/`blog`/`documentation`/`store`), keep `template` property temporarily
- [x] 2.2 `BlogPostEntity`: rename `postTags` relation to `tags`, keep legacy `tags` simple-array temporarily
- [x] 2.3 `PostTagEntity`: rename class to `TagEntity` (keep `@Entity({ name: 'post_tag' })`), add `slug` column
- [x] 2.4 `TranslationEntity`: add `category` column
- [x] 2.5 `CreatePageDto`: replace `template` with `section`, add `name` for slug generation
- [x] 2.6 `CreateBlogPostDto`: remove `tags` string[], keep `tagIds`
- [x] 2.7 `CreateBlogCategoryDto`: remove `description`, auto-generate slug from `name`
- [x] 2.8 `UpdateCategoryDto`: remove `description` field
- [x] 2.9 Create `CreateTagDto` and `UpdateTagDto` with `name`, `slug`

## Phase 3: Backend Services & Controllers

- [x] 3.1 Create `TagsService` with CRUD, slug uniqueness enforcement, soft-delete, and `name` translation support (`entityName: "Tag"`)
- [x] 3.2 Create `TagsController` exposing `GET/POST/PATCH/DELETE /cms/tags`
- [x] 3.3 Update `PagesService`: auto-generate slug from `name` when not provided; handle `section`; ignore `order` on create
- [x] 3.4 Update `BlogCategoriesService`: hydrate `description` from translations on read; persist `description` as translation on write/update
- [x] 3.5 Update `BlogPostsService`: add `uploadFeaturedImage(postId, file)` using `FilesS3Service` + `cdnBaseUrl`
- [x] 3.6 Update `BlogPostsController`: wire `POST /:id/featured-image`; ensure `GET /:id/preview` returns hydrated data for unpublished posts
- [x] 3.7 Update `TranslationsService`: allow `entityName` filter without requiring `entityId`

## Phase 4: Data Backfill Migrations

- [x] 4.1 Map `page.template` values to `page.section` (`landing`→`landing`, `generic`→`blog`, `contact`→`store`)
- [x] 4.2 Migrate `blog_category.description` values into `translation` rows (`entityName: "Category"`, `key: "description"`, `lang: "es"`)
- [x] 4.3 Populate `post_tag.slug` from existing `name` values (kebab-case)

## Phase 5: Destructive Migrations & Entity Cleanup

- [x] 5.1 Drop `template` column from `page` table
- [x] 5.2 Drop `tags` simple-array column from `blog_post` table
- [x] 5.3 Drop `description` column from `blog_category` table
- [x] 5.4 `PageEntity`: remove `template` property
- [x] 5.5 `BlogPostEntity`: remove legacy `tags` simple-array property
- [x] 5.6 `BlogCategoryEntity`: remove `description` property

## Phase 6: Frontend TanStack Query Migration

- [ ] 6.1 Refactor `useCmsPages.ts` from `fetchWrapper` to `useQuery`/`useMutation`; update interfaces to use `section`
- [ ] 6.2 Refactor `useCmsBlogPosts.ts` from `fetchWrapper` to `useQuery`/`useMutation`; remove `tags` string[]
- [ ] 6.3 Refactor `useCmsCategories.ts` from `fetchWrapper` to `useQuery`/`useMutation`; expect `description` from API
- [ ] 6.4 Create `useCmsTags.ts` with `useQuery` for list and `useMutation` for create/update/delete
- [ ] 6.5 Update page/category UI components to consume `section` and translated `description`

## Phase 7: Tests

- [x] 7.1 Unit tests: page slug generation, tag slug uniqueness, category DTO validation
- [x] 7.2 Integration tests: Tag CRUD endpoints, category description hydration, translation `entityName`-only filter
- [x] 7.3 Integration tests: featured image CDN upload, blog post preview for unpublished posts
- [x] 7.4 E2E tests: admin page creation flow, blog post publish/preview flow
