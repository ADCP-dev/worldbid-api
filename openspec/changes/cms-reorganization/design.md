# Design: CMS Reorganization

## Technical Approach

Evolve the existing CMS modules (pages, blog posts, categories, tags) and translation layer. Keep changes within `src/modules/cms/` and `src/modules/translations/`. Reuse the existing S3-compatible storage driver for CDN uploads. Migrate frontend composables from manual `fetchWrapper` to TanStack Query.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Page `section` vs `template` | Add `section` enum; deprecate `template` (drop from DTOs/validation, keep DB column temporarily) | Preserves existing data during rollout; `section` has 4 values vs 3 |
| BlogPost `tags` | Remove `tags` simple-array; rename `postTags` relation to `tags` | Canonical many-to-many already exists; simple-array is redundant |
| Category `description` | Remove DB column; store as dynamic translations (`entityName: "Category"`) | Aligns with CMS i18n strategy |
| TagEntity | Enhance existing `PostTagEntity` → `TagEntity`; add `slug` + soft-delete | Table `post_tag` already exists; avoids destructive rename |
| CDN upload | Reuse `FilesS3Service` with `cdnBaseUrl` config | Backblaze/Bunny/Cloudflare are S3-compatible; zero new driver code |
| Frontend data fetching | Replace `fetchWrapper` composables with TanStack Query | Required by proposal; enables automatic caching and invalidation |

## Data Flow

```
Admin UI ──→ TanStack Query ──→ API (NestJS)
                                ├── PagesService
                                ├── BlogPostsService
                                ├── CategoriesService + TranslationsService
                                └── TagsService
                 ↑                    ↓
          Cache (Vue Query)    ←  PostgreSQL
                                └── FileEntity (S3/CDN)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `page.entity.ts` | Modify | Add `section` enum; deprecate `template` |
| `blog-post.entity.ts` | Modify | Remove `tags` simple-array; rename `postTags`→`tags` |
| `blog-category.entity.ts` | Modify | Remove `description` column |
| `post-tag.entity.ts` | Modify | Rename class to `TagEntity`; add `slug`, `deletedAt` |
| `translation.entity.ts` | Modify | Add `category` column |
| `create-page.dto.ts` | Modify | Replace `template` with `section`; add `name` |
| `create-post.dto.ts` | Modify | Remove `tags` string[]; keep `tagIds` |
| `create-category.dto.ts` | Modify | Remove `description`; add `name` slug auto-gen |
| `tag.dto.ts` | Create | DTOs for tag CRUD |
| `tags.controller.ts` | Create | `GET/POST/PATCH/DELETE /cms/tags` |
| `tags.service.ts` | Create | Tag CRUD + slug uniqueness |
| `posts.controller.ts` | Modify | Add `POST /:id/featured-image` |
| `posts.service.ts` | Modify | Add `uploadFeaturedImage` using `FilesS3Service` |
| `useCmsPages.ts` | Modify | Migrate to `useQuery`/`useMutation` |
| `useCmsBlogPosts.ts` | Modify | Migrate to `useQuery`/`useMutation` |
| `useCmsCategories.ts` | Modify | Migrate to `useQuery`/`useMutation` |
| `useCmsTags.ts` | Create | TanStack Query composable for tags |
| `Migration: AddSectionToPage` | Create | Add `section`, map `template` data |
| `Migration: AddCategoryToTranslation` | Create | Add `category` column |
| `Migration: MigrateCategoryDescription` | Create | Move `description` values to translations |
| `Migration: EnhanceTagEntity` | Create | Add `slug`, `deletedAt` to `post_tag` |
| `Migration: RemoveBlogPostTagsArray` | Create | Drop `tags` simple-array column |

## Interfaces / Contracts

```typescript
export enum PageSection {
  LANDING = 'landing',
  BLOG = 'blog',
  DOCUMENTATION = 'documentation',
  STORE = 'store',
}
```

Tag API response shape:
```typescript
interface TagResponse {
  id: string;
  slug: string;
  name: string; // hydrated from translation or fallback
}
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Slug auto-generation, DTO validation | Jest with Zod/class-validator |
| Integration | Tag CRUD, category translation hydration | Supertest against controller |
| E2E | Page creation flow, featured image upload | Playwright admin flows |

## Migration / Rollout

1. Run DB migrations (additive first: `section`, `category`, `slug`).
2. Deploy backend with new DTOs/controllers.
3. Backfill: migrate `template`→`section`, `description`→translations.
4. Run destructive migrations (drop `template`, `tags` array, `description` column).
5. Deploy frontend TanStack Query refactor.

## Open Questions

- [ ] Should `TagEntity` table be renamed from `post_tag` to `tag`? (Breaking for raw SQL queries.)
- [ ] Should page `order` column be dropped in a later migration, or kept for rollback safety?
