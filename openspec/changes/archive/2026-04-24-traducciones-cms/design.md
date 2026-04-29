# Design: Traducciones CMS

## Technical Approach

Reuse the existing `TranslationEntity` polymorphic system for Blog Posts and introduce category-based translations for Pages. Add a batch atomic upsert endpoint to replace frontend `Promise.all` spam. Migrate `metaTitle` and `metaDescription` from `seo_metadata` into translations. On the frontend, introduce a reusable `TranslationFields` component with language tabs and update Zod schemas to model per-language field maps.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Blog Post translation pattern | Polymorphic (`entityName='BlogPost'`, `entityId={id}`, `section='blog-post'`) | JSONB column on `BlogPostEntity` | Existing system already supports this; no schema change needed; queryable per field |
| Page translation pattern | Category-based (`category='page.{name}'`, `section='page'`) | Polymorphic like BlogPost | User explicitly wants explicit user control over page identity without FK cascade side effects |
| Page `name` uniqueness | Unique index on `PageEntity.name`, kebab-case validated in DTO | Composite unique with `section` | `name` drives the translation category; must be globally unique to avoid collision |
| Slug resolution (public) | Query `translation` table by `key='slug'` + `langCode`, join to entity | Store fallback slug on entity | Enables true per-language URLs; fallback slug can still exist for backwards compatibility |
| Batch save | Atomic upsert via QueryRunner transaction | Individual `createTranslation` calls in loop | Reduces API calls from N*langs to 1; guarantees consistency |
| N+1 prevention | Load all translations for an entity in a single query, then map in memory | TypeORM `relations` eager loading | `TranslationEntity` is not directly related; manual batched query avoids N+1 |
| SEO migration | Copy `metaTitle`/`metaDescription` from `seo_metadata` to translation records, then read from translations | Keep dual source | Single source of truth; `seo_metadata` retains `ogImage`, `canonicalUrl`, JSON-LD |

## Data Flow

### Blog Post Create

```
Admin Form ──→ POST /cms/blog/posts ──→ BlogPostsService.create()
                                              │
                                              ↓
                              POST /translations/dynamic/batch
                                              │
                                              ↓
                         TranslationsService.batchUpsert(tx)
                                              │
                                              ↓
                                    Response with post + translations
```

### Public Page Load (by slug)

```
GET /cms/pages/public/:slug ──→ PagesService.findBySlugPublic()
                                       │
                                       ↓
              Query translation WHERE key='slug' AND content=:slug
                                       │
                                       ↓
                           Load PageEntity by resolved id
                                       │
                                       ↓
              Query all translations for page (category='page.{name}')
                                       │
                                       ↓
                               Return merged DTO
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/back/src/modules/cms/pages/infrastructure/entities/page.entity.ts` | Modify | Add `name` column (varchar, unique, indexed) |
| `apps/back/src/modules/cms/pages/dto/create-page.dto.ts` | Modify | Add `name` validation (kebab-case regex); make `slug` optional if `name` provided |
| `apps/back/src/modules/cms/pages/pages.service.ts` | Modify | Auto-generate `slug` from `name`; use category translations; resolve slug via translation table |
| `apps/back/src/modules/cms/blog/posts/posts.service.ts` | Modify | Remove direct `slug` reliance for public reads; load translations in batch |
| `apps/back/src/modules/translations/translations.service.ts` | Modify | Add `batchUpsertDynamic(items, options)` with transaction |
| `apps/back/src/modules/translations/translations.controller.ts` | Modify | Add `POST /translations/dynamic/batch` endpoint |
| `apps/back/src/modules/translations/dto/batch-translation.dto.ts` | Create | DTO for batch items array + optional `entityName`/`entityId` |
| `apps/back/src/modules/cms/seo/seo.service.ts` | Modify | Read `metaTitle`/`metaDescription` from translations; remove from `SeoMetadataEntity` writes |
| `apps/front/modules/cms/schemas/blog-post.schema.ts` | Modify | Add `translations: z.record(z.record(z.string()))` structure |
| `apps/front/modules/cms/schemas/page.schema.ts` | Modify | Add `name` field; add `translations` structure |
| `apps/front/modules/cms/composables/useCmsBlogPosts.ts` | Modify | Replace `saveAllTranslations` with `saveTranslationsBatch` |
| `apps/front/modules/cms/composables/useCmsPages.ts` | Modify | Replace `saveAllTranslations` with `saveTranslationsBatch` |
| `apps/front/modules/cms/components/TranslationFields.vue` | Create | Reusable component with language tabs and field sections |

## Interfaces / Contracts

### Batch Upsert DTO

```typescript
export class BatchTranslationItemDto {
  langCode: string
  key: string
  content: string
  section?: string
  category?: string
  entityName?: string
  entityId?: string
}

export class BatchTranslationDto {
  items: BatchTranslationItemDto[]
}
```

### Batch Upsert Service Method

```typescript
async batchUpsertDynamic(
  items: BatchTranslationItemDto[],
  options?: { entityName?: string; entityId?: string },
): Promise<TranslationEntity[]>
```

Uses `QueryRunner` transaction. Deletes existing translations matching `(entityName, entityId, key)` for provided keys, then inserts all items. Limit: 50 items per call.

### Frontend Translation Model

```typescript
type TranslationMap = Record<string, Record<string, string>>
// { es: { title: '...', slug: '...' }, en: { title: '...', slug: '...' } }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `TranslationsService.batchUpsertDynamic` | In-memory SQLite; verify atomic rollback on failure |
| Unit | `PagesService` slug resolution from translations | Mock translation repository |
| Integration | `POST /translations/dynamic/batch` | Supertest; verify 50-item limit; verify auth guard |
| Integration | Blog post create + batch save flow | Supertest; create post then batch translations; assert returned structure |
| E2E | Frontend language selector saves all fields | Playwright; fill Spanish + English, save, reload, assert |

## Migration / Rollout

1. **Schema migration**: Add `page.name` (nullable initially). Backfill from existing `page.slug` (slugify → kebab-case). Then add `NOT NULL` + unique constraint.
2. **Data migration**: For every `seo_metadata` row, create translation records with `entityName='BlogPost'` or `category='page.{name}'`, keys `metaTitle` and `metaDescription`.
3. **Deploy**: Backend first (new endpoint, updated services). Frontend second (uses new batch endpoint). No breaking change for existing `POST /translations` single-create.
4. **Rollback**: Drop `page.name` (was nullable). Frontend falls back to `saveTranslation` individual calls if batch 404s. `seo_metadata` table untouched — data still exists.

## Open Questions

- [ ] Should `page.name` be editable after creation? If yes, all translations with old `category` must be updated — decide if service handles this automatically.
- [ ] For public slug resolution, should we index `(key='slug', content)` or add a generated column for faster lookup?
