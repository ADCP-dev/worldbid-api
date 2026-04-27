# Proposal: Traducciones CMS

## Intent

Add full multilingual support to CMS Blog Posts and Pages using the existing polymorphic translation system. Currently only `title` and `content` are partially supported for blog posts, and pages don't persist translations at all. We need per-language slugs, descriptions, excerpts, and SEO fields with a language selector in the UI.

## Scope

### In Scope
- Blog Posts: polymorphic translations (`entityName='BlogPost'` + `entityId`) for `title`, `slug`, `description`, `content`, `metaTitle`, `metaDescription`
- Pages: category-based translations (`category='page.{name}'`) with new `PageEntity.name` column (kebab-case, unique)
- Backend batch save endpoint for translations
- Frontend language selector in create/edit forms
- Zod schema updates to model multi-language structures
- Migrate `metaTitle` and `metaDescription` from `seo_metadata` table to translation system

### Out of Scope
- Blog categories and tags translations
- Non-CMS entity translations
- Automatic translation (AI) — manual entry only
- URL routing changes based on translated slugs

## Capabilities

### New Capabilities
- `cms-blog-translations`: Polymorphic translation CRUD for blog posts with full field coverage
- `cms-page-translations`: Category-based translation CRUD for pages with `name`-driven categories
- `batch-translation-save`: Atomic batch upsert endpoint for saving all translations of an entity at once

### Modified Capabilities
- `seo-metadata`: `metaTitle` and `metaDescription` will be sourced from translations instead of `seo_metadata` table (delta spec)

## Approach

**Blog Posts (Polymorphic)**
Reuse existing `TranslationEntity` fields: `entityName='BlogPost'`, `entityId={postId}`, `section='blog-post'`, keys per field. The `slug` is fully translatable (different URL per language) per user requirement. Non-translated fields (`featuredImageId`, `categoryId`, `tags`) remain on `BlogPostEntity`.

**Pages (Category-Based)**
Add `name` column to `PageEntity`: kebab-case, unique, validated. Translations use `category='page.{name}'` and `section='page'`. Same keys as blog posts. No polymorphism — this trades FK/cascade integrity for explicit user control per user request.

**Batch Saving**
New `POST /translations/batch` accepts array of `{entityName, entityId, langCode, section, key, content}` and performs atomic upsert. Frontend composables will use this instead of `Promise.all` with individual calls.

**SEO Migration**
`metaTitle` and `metaDescription` move from `SeoMetadataEntity` to translations. Existing data will be migrated to translation records on deployment.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/back/src/modules/cms/pages/infrastructure/entities/page.entity.ts` | Modified | Add `name` column, unique kebab-case |
| `apps/back/src/modules/translations/translations.service.ts` | Modified | Add batch upsert method |
| `apps/back/src/modules/translations/translations.controller.ts` | Modified | Add `POST /translations/batch` endpoint |
| `apps/back/src/modules/cms/blog/posts/*` | Modified | Return translations in find queries |
| `apps/back/src/modules/cms/pages/*` | Modified | Return translations in find queries |
| `apps/front/modules/cms/composables/useCmsBlogPosts.ts` | Modified | Use batch save, support all keys |
| `apps/front/modules/cms/composables/useCmsPages.ts` | Modified | Use batch save, support all keys |
| `apps/front/modules/cms/schemas/blog-post.schema.ts` | Modified | Model multi-language structure |
| `apps/front/modules/cms/schemas/page.schema.ts` | Modified | Model multi-language structure |
| `apps/front/modules/cms/pages/**` | Modified | Add language selector to forms |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing `seo_metadata` data loss during migration | Low | Migration script copies `metaTitle`/`metaDescription` to translations before dropping reliance |
| Page `name` uniqueness conflicts on existing data | Med | Migration generates kebab-case names from existing slugs; validate uniqueness |
| Batch endpoint performance with many languages | Low | Limit batch size to 50 items; use `save` with `upsert` semantics |
| Frontend forms break during transition | Med | Feature-flag or atomic deploy; update composables and pages together |

## Rollback Plan

1. Revert backend migrations for `PageEntity.name` (nullable, safe to drop)
2. Restore `seo_metadata` as source of truth for meta fields
3. Frontend falls back to old composables if API batch endpoint unavailable
4. Translation data remains in `translation` table — no data loss

## Dependencies

- Existing `TranslationEntity` and `TranslationsService` polymorphic support
- Language list from `LangEntity` (already available)

## Success Criteria

- [ ] Blog post create/edit form shows language selector and saves all 6 translatable fields per language
- [ ] Page create/edit form shows language selector and saves all 6 translatable fields per language
- [ ] `POST /translations/batch` handles upsert of 50 records in < 500ms
- [ ] Existing SEO data migrated and `metaTitle`/`metaDescription` read from translations
- [ ] Page `name` is kebab-case, unique, and drives `category` value in translations
