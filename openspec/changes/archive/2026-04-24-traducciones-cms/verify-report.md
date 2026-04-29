# Verification Report: traducciones-cms

**Change**: traducciones-cms
**Version**: N/A
**Mode**: Standard (Strict TDD not configured)
**Date**: 2026-04-24

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 22 |
| Tasks complete | 16 |
| Tasks incomplete | 6 |

### Incomplete Tasks (Phase 5: Testing)
- [ ] 5.1 Unit test: `TranslationsService.batchUpsertDynamic` — verify atomic insert, 50-item rejection, rollback on failure
- [ ] 5.2 Integration test: `POST /translations/dynamic/batch` — auth, validation, happy path
- [ ] 5.3 Integration test: blog post public slug resolution via translations + fallback
- [ ] 5.4 Integration test: page public slug resolution via category translations + fallback
- [ ] 5.5 E2E test: admin creates blog post with `es` + `en` translations, verifies reload
- [ ] 5.6 E2E test: admin creates page with `name` and translations, public slug resolves correctly

---

## Build & Tests Execution

**Build**: ❌ Failed
```
src/modules/translations/translations.service.ts:679:11 - error TS2769:
No overload matches this call.
  Overload 2 of 2, '(entityClass: EntityTarget<TranslationEntity>,
  plainObjects?: DeepPartial<TranslationEntity>[] | undefined):
  TranslationEntity[]', gave the following error:
    Object literal may only specify known properties, but 'key' does not
    exist in type 'DeepPartial<TranslationEntity>[]'. Did you mean to
    write 'keys'?
```

**Tests**: ❌ 0 passed / 0 failed / 0 skipped — Tests fail to compile due to the same TypeScript error above. No test suites can execute.

**Coverage**: ➖ Not available (tests cannot run)

---

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Blog Post Translatable Fields | Creating a post with translations | (none found) | ❌ UNTESTED |
| Blog Post Translatable Fields | Reading a post with translations | (none found) | ❌ UNTESTED |
| Blog Post Slug — Remove Unique | Duplicate base slug allowed | (none found) | ❌ UNTESTED |
| Public Slug Resolution (Blog) | Find post by translated slug | (none found) | ❌ UNTESTED |
| Public Slug Resolution (Blog) | Fallback to base slug | (none found) | ❌ UNTESTED |
| Blog Post List/Detail | List includes translations | (none found) | ❌ UNTESTED |
| Page Name Column | Creating a page with name | (none found) | ❌ UNTESTED |
| Page Name Column | Rejecting invalid name | (none found) | ❌ UNTESTED |
| Page Translatable Fields | Creating page translations via category | (none found) | ❌ UNTESTED |
| Page Slug — Remove Unique | Duplicate base slug allowed | (none found) | ❌ UNTESTED |
| Page Response Structure | Page list with translations | (none found) | ❌ UNTESTED |
| Batch Upsert Endpoint | Batch upsert for blog post | (none found) | ❌ UNTESTED |
| Batch Upsert Endpoint | Batch size limit | (none found) | ❌ UNTESTED |
| Frontend Batch Composable | Saving all languages | (none found) | ❌ UNTESTED |
| Meta Title/Description Sourcing | Reading SEO for a page | (none found) | ❌ UNTESTED |
| Meta Title/Description Sourcing | Migration of existing SEO data | (none found) | ❌ UNTESTED |

**Compliance summary**: 0/16 scenarios compliant (no tests exist; build prevents execution)

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| BlogPostEntity: remove unique from slug | ✅ Implemented | `@Index()` without `unique: true` on line 27-29 |
| PageEntity: add name column (unique, NOT NULL) | ✅ Implemented | `@Index({ unique: true })` on line 30-32; type `String` |
| PageEntity: remove unique from slug | ✅ Implemented | `@Index()` without `unique: true` on line 34-36 |
| Migration: MigrateSlugToTranslations | ✅ Implemented | Idempotent; copies blog_post.slug → TranslationEntity (es); copies page.slug → category-based translations |
| Migration: MigrateSeoMetadataToTranslations | ✅ Implemented | Idempotent; detects BlogPost vs Page; copies metaTitle/metaDescription for correct language |
| BatchTranslationDto: max 50 items | ✅ Implemented | `@ArrayMaxSize(50)` on line 54 |
| BatchTranslationDto: entityName/entityId/category validation | ✅ Implemented | `@ValidateIf` constraints on lines 30-45 |
| TranslationsService.batchUpsertDynamic: atomic transaction | ✅ Implemented | QueryRunner with `startTransaction`, `commitTransaction`, `rollbackTransaction` |
| TranslationsService.batchUpsertDynamic: 50-item limit | ✅ Implemented | Explicit check on line 626 |
| TranslationsController: POST /dynamic/batch with guards | ✅ Implemented | `@Post('dynamic/batch')` with `@Roles(RoleEnum.admin)` and `@UseGuards(AuthGuard('jwt'), RolesGuard)` |
| PostsService: load translations in list/detail | ✅ Implemented | `loadTranslationsForPosts()` uses single batched query with `In(postIds)` |
| PostsService: resolve public slug via TranslationEntity | ✅ Implemented | `findBySlugPublic()` queries `key='slug', section='blog-post', entityName='BlogPost'` with fallback to base slug |
| PagesService: auto slug from name | ✅ Implemented | `slug ?? slugify(name)` in `create()` |
| PagesService: load translations by category | ✅ Implemented | `loadTranslationsForPages()` queries `category: In(categories)` |
| PagesService: resolve public slug via TranslationEntity | ⚠️ Partial | Queries `key='slug', section='page', content=slug` but does NOT filter by `category LIKE 'page.%'`. Could match slug across different pages. Falls back to base slug correctly. |
| SeoService: read metaTitle/metaDescription from translations | ✅ Implemented | `resolveMetaFromTranslations()` tries BlogPost entity translations first, then Page category translations |
| Blog post schema: translations field | ✅ Implemented | `z.record(z.string(), translationItemSchema)` on line 19 |
| Page schema: name + translations fields | ✅ Implemented | `name` with kebab-case regex on line 15; translations on line 19 |
| TranslationFields.vue: tabs, all fields, auto slug, validation | ✅ Implemented | Language tabs with error badges; all 6 fields; slug auto-generates from title when empty; per-field validation display |
| useCmsBlogPosts: saveTranslationsBatch | ✅ Implemented | Calls `/translations/dynamic/batch` with `entityName: 'BlogPost'` |
| useCmsPages: saveTranslationsBatch | ✅ Implemented | Calls `/translations/dynamic/batch` with `category` |
| Blog post create form: TranslationFields + batch save | ✅ Implemented | Uses TranslationFields; calls `saveTranslationsBatch` per language via `Promise.all` |
| Blog post edit form: loads existing translations | ✅ Implemented | Populates `translations` from `post.translations` for all configured languages |
| Page create form: name field + TranslationFields + batch save | ✅ Implemented | Name field with kebab-case validation; slug auto-generation from name; TranslationFields; batch save with `page.{name}` category |
| Page edit form: loads existing translations | ✅ Implemented | Populates `translations` from `page.translations` for all configured languages |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Blog Post translation pattern: Polymorphic | ✅ Yes | `entityName='BlogPost'`, `entityId={id}`, `section='blog-post'` |
| Page translation pattern: Category-based | ✅ Yes | `category='page.{name}'`, `section='page'`, no entityName/entityId |
| Page `name` uniqueness: Unique index | ✅ Yes | `@Index({ unique: true })` on `name` |
| Slug resolution (public): Query translation table | ✅ Yes | Both services query TranslationEntity first, fallback to entity slug |
| Batch save: Atomic upsert via QueryRunner | ✅ Yes | Transaction wrapped with rollback on failure |
| N+1 prevention: Load all translations in single query | ✅ Yes | `In(postIds)` and `In(categories)` used |
| SEO migration: Copy metaTitle/metaDescription to translations | ✅ Yes | Migrations copy data; SeoService reads from translations |
| Frontend Translation Model: Record<lang, Record<key, string>> | ✅ Yes | Matches design spec |
| File Changes table | ✅ Yes | All files in design table were created/modified |

### Design Deviations
- **Batch DTO structure**: Design shows `BatchTranslationItemDto` with `langCode` per item and `BatchTranslationDto` with `items: BatchTranslationItemDto[]`. Implementation uses `BatchTranslationDto` with a top-level `lang` field and `translations: Array<{section, key, value}>`. This is functionally equivalent but structurally different from the design's proposed DTO. The spec also shows a different structure (`lang` at top level with `translations` array), so implementation matches the spec, not the design's proposed DTO. This is acceptable since spec takes precedence.

---

## Issues Found

### CRITICAL (must fix before archive)

1. **TypeScript Compilation Error in `translations.service.ts:679`**
   - **What**: `queryRunner.manager.create(TranslationEntity, { key: item.key, ... })` fails to compile.
   - **Why**: TypeORM's `EntityManager.create()` overload resolution fails; the compiler matches the array overload instead of the single-object overload, then complains that `key` doesn't exist on `DeepPartial<TranslationEntity>[]`.
   - **Where**: `apps/back/src/modules/translations/translations.service.ts` line 677-688
   - **Fix suggestion**: Use `const entity = new TranslationEntity(); Object.assign(entity, {...})` or use `queryRunner.manager.getRepository(TranslationEntity).create({...})` or cast the object: `queryRunner.manager.create(TranslationEntity, { ... } as DeepPartial<TranslationEntity>)`.
   - **Impact**: Backend build fails. Tests cannot run. Code cannot deploy.

2. **Zero Tests Written for the Change**
   - **What**: All 6 testing tasks (5.1–5.6) are incomplete. No unit, integration, or E2E tests exist for the new functionality.
   - **Why**: This means there is zero behavioral evidence that the implementation works as specified.
   - **Impact**: Cannot verify atomic transactions, batch limits, slug resolution, or form flows at runtime.

### WARNING (should fix)

3. **Page `findBySlugPublic` Missing Category Filter**
   - **What**: The query for translated page slugs uses `key='slug', section='page', content=slug` but does NOT include `category LIKE 'page.%'`.
   - **Why**: Per spec, slug resolution should match `category LIKE 'page.%'`. Without this filter, two different pages could theoretically have the same translated slug value, causing ambiguous matches.
   - **Where**: `apps/back/src/modules/cms/pages/pages.service.ts` lines 181-186
   - **Fix suggestion**: Add `.andWhere('translation.category LIKE :catPrefix', { catPrefix: 'page.%' })` to the query.

4. **Blog Post DTO Lacks Kebab-Case Validation for Slug**
   - **What**: `CreateBlogPostDto` has `@IsString()` and `@IsNotEmpty()` for `slug` but no `@Matches(/^[a-z0-9-]+$/)`.
   - **Why**: Spec requires kebab-case validation. The frontend schema enforces it, but the backend DTO does not.
   - **Where**: `apps/back/src/modules/cms/blog/posts/dto/create-post.dto.ts` lines 11-14
   - **Fix suggestion**: Add `@Matches(/^[a-z0-9-]+$/, { message: 'Must be kebab-case' })`.

5. **Page Create DTO Allows Empty Slug**
   - **What**: `CreatePageDto.slug` is `@IsOptional()` and lacks `@IsNotEmpty()`.
   - **Why**: The service auto-generates slug from name, which is fine for creation. But if a slug is explicitly provided as an empty string, it may pass validation.
   - **Where**: `apps/back/src/modules/cms/pages/dto/create-page.dto.ts` lines 21-24
   - **Fix suggestion**: Either keep optional (service handles it) or add `@IsNotEmpty()` if provided.

6. **`saveTranslationsBatch` Still Uses `Promise.all` Per Language**
   - **What**: The frontend calls `saveTranslationsBatch` once per language, then wraps all calls in `Promise.all`. For 3 languages, this is 3 API calls.
   - **Why**: The spec's "Frontend Batch Composable" scenario says: "THEN the frontend calls the batch endpoint once per language." This is technically compliant with the spec, but the design's intent was to reduce API calls. The backend batch endpoint supports up to 50 items — a single language's translations are only 6 items. There is no backend endpoint to batch across multiple languages in one call.
   - **Where**: `apps/front/modules/cms/pages/app/cms/blog/posts/create.vue` lines 202-214; `apps/front/modules/cms/pages/app/cms/pages/create.vue` lines 136-148
   - **Impact**: Low — 3 API calls instead of 18 is still a significant improvement over individual saves.

### SUGGESTION (nice to have)

7. **TranslationFields.vue: Slug Auto-Generation from Name for Pages**
   - **What**: The spec says "Slug auto-generates from Name for default language" on the Page form. The `TranslationFields` component auto-generates slug from `title`, not from the page `name`.
   - **Why**: For pages, the default-language slug should come from `name`, not `title`. The page create/edit forms already auto-generate the base `slug` from `name` in the form ref, but the per-language translation slug still uses the `title`-based logic inside `TranslationFields.vue`.
   - **Where**: `apps/front/modules/cms/components/TranslationFields.vue` lines 83-91
   - **Fix suggestion**: Accept a prop like `slugSource` or `autoSlugFrom` to allow the parent to specify which field drives auto-generation.

8. **Missing `app` Field in Batch Translation Items**
   - **What**: The `batchUpsertDynamic` service method sets `app: item.section ? undefined : 'cms'`. This means `app` is only set when `section` is falsy.
   - **Why**: For blog posts and pages, `section` is always provided ('blog-post' or 'page'), so `app` is never set. This may affect JSON file generation if the translation system relies on `app` for grouping.
   - **Where**: `apps/back/src/modules/translations/translations.service.ts` line 682
   - **Fix suggestion**: Explicitly set `app: 'cms'` for dynamic CMS translations.

9. **`findBySlugPublic` for Blog Posts Does Not Filter by Language**
   - **What**: The blog post slug lookup queries `content: slug` but does not restrict by `langCode`.
   - **Why**: The same slug could exist in different languages for different posts (e.g., "hello-world" in English for Post A and "hello-world" in Spanish for Post B). The current query would return whichever matches first.
   - **Where**: `apps/back/src/modules/cms/blog/posts/posts.service.ts` lines 189-196
   - **Fix suggestion**: Add `lang: { code: requestedLang }` to the query, or document that slugs must be globally unique across languages.

10. **Page `update` Does Not Handle `name` Change Cascade**
   - **What**: If a page's `name` is updated, all existing translations under `page.{oldName}` remain orphaned. The design's "Open Questions" explicitly flags this.
   - **Why**: The spec does not require automatic category migration, but it is a known gap.
   - **Where**: `apps/back/src/modules/cms/pages/pages.service.ts` lines 216-224

---

## Verdict

**FAIL**

The implementation is structurally complete and largely matches the spec and design, but it **cannot compile or deploy** due to a TypeScript error in `translations.service.ts`. Additionally, **zero tests were written** for the change, meaning there is no behavioral evidence of correctness. The combination of a broken build and missing tests makes this change unmergeable in its current state.

### Required Actions to Pass
1. Fix the TypeScript compilation error in `translations.service.ts:679`.
2. Write at minimum unit tests for `batchUpsertDynamic` (atomicity, 50-item limit, rollback).
3. Write integration tests for public slug resolution (both blog posts and pages).
4. (Recommended) Address the Page `findBySlugPublic` missing category filter.
5. (Recommended) Add kebab-case validation to `CreateBlogPostDto.slug`.
