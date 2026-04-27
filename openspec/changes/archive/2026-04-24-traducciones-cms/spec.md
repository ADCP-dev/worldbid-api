# Spec: Traducciones CMS

## Overview

Add full multilingual support to Blog Posts (polymorphic translations) and Pages (category-based translations). Introduce a batch save endpoint and migrate `metaTitle`/`metaDescription` from `seo_metadata` to the translation system.

---

## Domain: Blog Post Translations (Polymorphic)

### ADDED Requirements

#### Requirement: Blog Post Translatable Fields

The system MUST store `title`, `slug`, `description`, `content`, `metaTitle`, and `metaDescription` in `TranslationEntity` with `entityName='BlogPost'`, `entityId=post.id`, `section='blog-post'`.

##### Scenario: Creating a blog post with translations

- GIVEN an admin creates a post with `categoryId`, `tagIds`, `isPublished`
- AND provides `es` translations for all 6 keys
- WHEN persisted
- THEN `BlogPostEntity` holds non-translatable fields
- AND 6 `TranslationEntity` records are created for `es`

##### Scenario: Reading a blog post with translations

- GIVEN a post with `es` and `en` translations
- WHEN `GET /cms/blog/posts/:id` is called
- THEN the response includes `translations: { es: { title, slug, ... }, en: { ... } }`

#### Requirement: Blog Post Slug — Remove Unique Constraint

The system MUST remove the `unique` constraint from `BlogPostEntity.slug`. It SHALL serve as the base/canonical slug.
(Previously: `slug` was unique at the database level.)

##### Scenario: Duplicate base slug allowed

- GIVEN two posts with `slug: "hello-world"`
- WHEN persisted
- THEN both rows are allowed
- AND translated slugs differentiate URLs per language

#### Requirement: Public Slug Resolution via Translations

The system MUST resolve public blog post lookups by querying `TranslationEntity` for `key='slug'`, `section='blog-post'`, `entityName='BlogPost'`.
(Previously: Lookups matched `BlogPostEntity.slug` directly.)

##### Scenario: Find post by translated slug

- GIVEN a published post with a Spanish slug translation `hola-mundo`
- WHEN `GET /cms/blog/posts/public/slug/hola-mundo` is called
- THEN the matching post is returned with its translations

##### Scenario: Fallback to base slug

- GIVEN a post with no translated slug for the requested language
- WHEN the base `BlogPostEntity.slug` is used in the URL
- THEN the post is returned with available translations

### MODIFIED Requirements

#### Requirement: Blog Post List and Detail Responses

The system MUST include `translations` in all blog post read responses.
(Previously: Responses did not include translations.)

##### Scenario: List includes translations

- GIVEN a paginated list of posts
- WHEN `GET /cms/blog/posts` is called
- THEN each item includes `translations` keyed by language

---

## Domain: Page Translations (Category-Based)

### ADDED Requirements

#### Requirement: Page Name Column

The system MUST add a `name` column to `PageEntity`:
- Type: `string`, NOT NULL
- Unique at database level
- Validated as kebab-case (`/^[a-z0-9-]+$/`)
- Drives `category='page.{name}'` for translations

##### Scenario: Creating a page with name

- GIVEN a create request with `name: "about-us"`
- WHEN persisted
- THEN `PageEntity.name` equals `"about-us"`
- AND translations use `category: "page.about-us"`

##### Scenario: Rejecting invalid name

- GIVEN a create request with `name: "About Us"`
- WHEN validated
- THEN the system rejects with 400 Bad Request

#### Requirement: Page Translatable Fields

The system MUST store `title`, `slug`, `description`, `content`, `metaTitle`, and `metaDescription` in `TranslationEntity` with `category='page.{name}'`, `section='page'`, and NO `entityName`/`entityId`.

##### Scenario: Creating page translations via category

- GIVEN a page with `name: "contact"`
- WHEN batch save is called with `category: "page.contact"`, `lang: "es"`, and 6 keys
- THEN records have `category='page.contact'`, `section='page'`, null `entityName`/`entityId`

#### Requirement: Page Slug — Remove Unique Constraint

The system MUST remove the `unique` constraint from `PageEntity.slug`. It SHALL serve as the base/canonical slug.
(Previously: `slug` was unique at the database level.)

### MODIFIED Requirements

#### Requirement: Page Response Structure

The system MUST include `name` and `translations` in all page read responses.
(Previously: `name` was not persisted; title was loaded ad-hoc via `getTranslationsForEntity`.)

##### Scenario: Page list with translations

- GIVEN pages with translations
- WHEN `GET /cms/pages` is called
- THEN each item includes `name` and `translations` keyed by language
- AND the query does NOT cause N+1

---

## Domain: Batch Translation Save

### ADDED Requirements

#### Requirement: Batch Upsert Endpoint

The system MUST expose `POST /api/v1/translations/dynamic/batch` accepting:
```json
{
  "entityName?": "string",
  "entityId?": "string",
  "category?": "string",
  "lang": "string",
  "translations": [{ "section": "string", "key": "string", "value": "string" }]
}
```
Exactly one of (`entityName`+`entityId`) OR `category` MUST be provided. `translations` length MUST be ≤ 50.

##### Scenario: Batch upsert for blog post

- GIVEN a post with `id: "post-1"`
- AND a payload with `entityName: "BlogPost"`, `entityId: "post-1"`, `lang: "es"`, 6 items
- WHEN the endpoint is called
- THEN all 6 translations are upserted atomically

##### Scenario: Batch size limit

- GIVEN a payload with 51 items
- WHEN the endpoint is called
- THEN the system rejects with 400 Bad Request

#### Requirement: Frontend Batch Composable

The frontend composables `useCmsBlogPosts` and `useCmsPages` MUST expose `saveTranslationsBatch` and use it instead of `Promise.all` with individual saves.

##### Scenario: Saving all languages

- GIVEN a form with `es`, `en`, `fr` translations
- WHEN the user clicks save
- THEN the frontend calls the batch endpoint once per language

---

## Domain: SEO Metadata (Modified)

### MODIFIED Requirements

#### Requirement: Meta Title and Description Sourcing

The system MUST source `metaTitle` and `metaDescription` from the translation system. `SeoMetadataEntity` MUST continue storing all other fields (`metaKeywords`, `ogImage`, `canonicalUrl`, `robotsPolicy`, `hreflangEnabled`, `hreflangAlternateLocales`, `hreflangCustomUrls`, `customJsonLd`, `type`).
(Previously: `metaTitle` and `metaDescription` were stored in and read from `SeoMetadataEntity`.)

##### Scenario: Reading SEO for a page

- GIVEN a page with `metaTitle`/`metaDescription` in translations
- AND `metaKeywords`/`robotsPolicy` in `SeoMetadataEntity`
- WHEN the SEO endpoint is called
- THEN `metaTitle`/`metaDescription` come from translations
- AND remaining fields come from `SeoMetadataEntity`

##### Scenario: Migration of existing SEO data

- GIVEN existing `SeoMetadataEntity` records with `metaTitle`/`metaDescription`
- WHEN the migration runs
- THEN those values are copied to `TranslationEntity` for default language `es`
- AND all other `SeoMetadataEntity` fields are preserved

---

## Data Model Changes

| Entity | Change | Field | Details |
|--------|--------|-------|---------|
| `BlogPostEntity` | Remove unique | `slug` | Drop `@Index({ unique: true })`, keep index |
| `PageEntity` | Add | `name` | `string`, NOT NULL, `@Index({ unique: true })`, kebab-case |
| `PageEntity` | Remove unique | `slug` | Drop `@Index({ unique: true })`, keep index |
| `SeoMetadataEntity` | Deprecate | `metaTitle` | Stop writing; read from translations |
| `SeoMetadataEntity` | Deprecate | `metaDescription` | Stop writing; read from translations |

## API Specifications

### `POST /api/v1/translations/dynamic/batch`
- **Auth**: JWT + `RoleEnum.admin`
- **Body**: See Batch Upsert Endpoint above
- **Success**: `201 Created` — array of saved `TranslationEntity` records
- **Errors**: `400` (invalid payload, size > 50), `404` (lang not found)

### `GET /cms/blog/posts` (Modified)
- **Response**: Posts array with `translations: Record<lang, { title, slug, description, content, metaTitle, metaDescription }>`

### `GET /cms/blog/posts/:id` (Modified)
- **Response**: Includes `translations` object

### `GET /cms/blog/posts/public/slug/:slug` (Modified)
- **Behavior**: Queries `TranslationEntity` for `key='slug'`, `section='blog-post'`, `entityName='BlogPost'`. Falls back to `BlogPostEntity.slug`.

### `GET /cms/pages` (Modified)
- **Response**: Pages array with `name` and `translations`

### `GET /cms/pages/:id` (Modified)
- **Response**: Includes `name` and `translations`

### `GET /cms/pages/public/slug/:slug` (Modified)
- **Behavior**: Queries `TranslationEntity` for `key='slug'`, `section='page'`, matching `category LIKE 'page.%'`. Falls back to `PageEntity.slug`.

## Frontend Specifications

### Blog Post Form
- **Top (non-translatable)**: Cover image, Category select, Tags multi-select, IsPublished toggle
- **Language selector**: Tabs showing available languages
- **Per-language fields**: Title, Slug, Description, Content, Meta Title, Meta Description
- **Auto-generation**: Slug auto-generates from title (kebab-case) when empty

### Page Form
- **Top (non-translatable)**: Name (kebab-case, unique), Section select, IsPublished toggle, Cover image
- **Language selector**: Tabs
- **Per-language fields**: Title, Slug, Description, Content, Meta Title, Meta Description
- **Auto-generation**: Slug auto-generates from Name for default language

### Composables
| Composable | Method | Signature |
|------------|--------|-----------|
| `useCmsBlogPosts` | `saveTranslationsBatch` | `(entityId, lang, translations[]) => Promise` |
| `useCmsPages` | `saveTranslationsBatch` | `(category, lang, translations[]) => Promise` |

## Validation Rules (Zod)

```typescript
const translationItemSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  content: z.string().min(1),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
})

const blogPostSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  categoryId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  translations: z.record(z.string(), translationItemSchema),
})

const pageSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  section: z.enum(['landing', 'blog', 'documentation', 'store']),
  isPublished: z.boolean().optional(),
  translations: z.record(z.string(), translationItemSchema),
})
```

## Error Handling

| Error | HTTP | Message |
|-------|------|---------|
| Invalid slug/name format | 400 | `Must be kebab-case` |
| Duplicate page name | 409 | `Page name already exists` |
| Batch size > 50 | 400 | `Batch size exceeds maximum of 50` |
| Missing entity/category in batch | 400 | `Either entityName+entityId or category is required` |
| Language not found | 404 | `Language with code "xx" not found` |
| Post/Page not found by slug | 404 | `Not found` |

## Non-Functional Requirements

- **Performance**: Batch endpoint MUST process 50 records in < 500ms. List endpoints MUST load translations efficiently (no N+1).
- **Security**: Batch endpoint requires `admin` role. All write endpoints use `AuthGuard('jwt')` + `RolesGuard`.
- **Migration**: Idempotent. Preserves existing data. `BlogPostEntity.slug` and `PageEntity.slug` remain as fallback values.

## Test Scenarios

### Backend
1. Batch upsert creates and updates translations
2. Batch rejects payloads with > 50 items
3. Blog post public slug lookup via `TranslationEntity`
4. Page public slug lookup via `TranslationEntity`
5. Blog post list/detail include `translations`
6. Page list/detail include `name` and `translations`
7. Migration copies existing slugs to translations as `es`
8. Migration copies existing `metaTitle`/`metaDescription` to translations as `es`

### Frontend
9. Form validates kebab-case `name`/`slug`
10. Validation errors display per language/field
11. Batch composable calls correct endpoint
12. Language switch preserves unsaved state
13. Slug auto-generation from title/name

### E2E
14. Admin creates blog post with 3 languages
15. Admin creates page with translations
16. Public blog/page resolves translated slug
17. SEO meta fields read from translations
