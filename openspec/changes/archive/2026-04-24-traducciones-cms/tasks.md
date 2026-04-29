# Tasks: Traducciones CMS

## Phase 1: Foundation — Database & Migrations

- [x] 1.1 Modify `apps/back/src/modules/cms/blog/posts/infrastructure/entities/blog-post.entity.ts` — remove `unique` from `slug` index, keep regular index. Complexity: **S**
- [x] 1.2 Modify `apps/back/src/modules/cms/pages/infrastructure/entities/page.entity.ts` — add `name` column (varchar, NOT NULL, unique indexed), remove `unique` from `slug` index. Complexity: **S**
- [x] 1.3 Create migration `MigrateSlugToTranslations` — copy existing `BlogPostEntity.slug` and `PageEntity.slug` into `TranslationEntity` as `es` language, `key='slug'`. Complexity: **M**
- [x] 1.4 Create migration `MigrateSeoMetadataToTranslations` — copy `metaTitle`/`metaDescription` from `SeoMetadataEntity` to `TranslationEntity` as `es` language. Complexity: **M**

## Phase 2: Core Backend — Batch Save & Service Updates

- [x] 2.1 Create `apps/back/src/modules/translations/dto/batch-translation.dto.ts` with `BatchTranslationItemDto` and `BatchTranslationDto` (max 50 items validation). Complexity: **S**
- [x] 2.2 Add `batchUpsertDynamic()` to `apps/back/src/modules/translations/translations.service.ts` — atomic upsert via `QueryRunner`, limit 50. Complexity: **M**
- [x] 2.3 Add `POST /translations/dynamic/batch` endpoint to `apps/back/src/modules/translations/translations.controller.ts` with JWT + admin guard. Complexity: **S**
- [x] 2.4 Modify `apps/back/src/modules/cms/blog/posts/posts.service.ts` — load translations in list/detail, resolve public slug via `TranslationEntity` query with fallback. Complexity: **M**
- [x] 2.5 Modify `apps/back/src/modules/cms/pages/pages.service.ts` — auto-generate `slug` from `name`, load translations by `category='page.{name}'`, resolve public slug via `TranslationEntity`. Complexity: **M**
- [x] 2.6 Modify `apps/back/src/modules/cms/seo/seo.service.ts` — read `metaTitle`/`metaDescription` from translations instead of `SeoMetadataEntity`. Complexity: **S**

## Phase 3: Core Frontend — Composables, Schemas & Components

- [x] 3.1 Modify `apps/front/modules/cms/schemas/blog-post.schema.ts` — add `translations: z.record(translationItemSchema)`. Complexity: **S**
- [x] 3.2 Modify `apps/front/modules/cms/schemas/page.schema.ts` — add `name` (kebab-case), add `translations`. Complexity: **S**
- [x] 3.3 Create `apps/front/modules/cms/components/TranslationFields.vue` — reusable language-tabs component with title, slug, description, content, metaTitle, metaDescription fields. Complexity: **M**
- [x] 3.4 Modify `apps/front/modules/cms/composables/useCmsBlogPosts.ts` — replace `saveAllTranslations` with `saveTranslationsBatch(entityId, lang, items)`. Complexity: **S**
- [x] 3.5 Modify `apps/front/modules/cms/composables/useCmsPages.ts` — replace `saveAllTranslations` with `saveTranslationsBatch(category, lang, items)`. Complexity: **S**

## Phase 4: Frontend Forms & UI

- [x] 4.1 Update blog post create/edit form — add `TranslationFields` component below non-translatable fields (cover, category, tags, isPublished). Complexity: **M**
- [x] 4.2 Update page create/edit form — add `name` field (kebab-case, unique) at top, add `TranslationFields` below non-translatable fields. Complexity: **M**

## Phase 5: Testing

- [ ] 5.1 Unit test: `TranslationsService.batchUpsertDynamic` — verify atomic insert, 50-item rejection, rollback on failure. Complexity: **M**
- [ ] 5.2 Integration test: `POST /translations/dynamic/batch` — auth, validation, happy path. Complexity: **M**
- [ ] 5.3 Integration test: blog post public slug resolution via translations + fallback. Complexity: **S**
- [ ] 5.4 Integration test: page public slug resolution via category translations + fallback. Complexity: **S**
- [ ] 5.5 E2E test: admin creates blog post with `es` + `en` translations, verifies reload. Complexity: **M**
- [ ] 5.6 E2E test: admin creates page with `name` and translations, public slug resolves correctly. Complexity: **M**
