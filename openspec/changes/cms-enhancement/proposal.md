# Proposal: cms-enhancement

## Intent

Enhance the existing CMS module with proper SEO infrastructure (robots, hreflang, JSON-LD schemas), fix the BlogPost-Category relationship (1 category + N tags), integrate nuxt-seo with i18n for localized sitemaps, and configure SSG at deploy time. AI features are architecture-only (no implementation).

## Scope

### In Scope
- Robots meta tag configuration per page/post via nuxt-seo
- hreflang tag generation integrated with i18n
- JSON-LD schema categorization system (Product, Article, BreadcrumbList, Organization)
- BlogPost ↔ Category relation (1:N — one category, many tags)
- nuxt-seo + i18n integration for localized sitemaps and hreflang
- SSG static generation configuration (deploy-time, no SWR)

### Out of Scope
- AI feature implementation (architecture placeholder only)
- On-demand ISR/revalidation
- New CMS entities beyond Category relation fix
- Rebuilding existing working functionality

## Capabilities

### New Capabilities
- `seo-json-ld-categorization`: Typed JSON-LD schema registry (Article, Product, Organization, BreadcrumbList) with factory pattern for reuse
- `seo-hreflang-i18n`: hreflang tag generation linked to i18n locale routes
- `cms-blog-category-relation`: BlogPostEntity with categoryId (1:1) + tags (N:N via join table)

### Modified Capabilities
- `cms-seo-metadata`: Extend SeoMetadataEntity with robots policies (index, follow, etc.) and hreflang configuration

## Approach

1. **Backend**: Add `categoryId` column to `BlogPostEntity`, create `PostTagEntity` for N:N tags relation, add `robotsTxt` and `hreflang` fields to `SeoMetadataEntity`
2. **Frontend (Nuxt)**: Configure `@nuxtjs/robots` module, add nuxt-seo i18n integration, create JSON-LD composable with schema factory
3. **SSG**: Configure `nuxt.config.ts` with `ssr: true` and `routeRules` for static pre-rendering at build time

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/back/src/modules/cms/domain/entities/` | Modified | Add categoryId to BlogPostEntity, create PostTagEntity |
| `apps/back/src/modules/cms/domain/entities/seo-metadata.entity.ts` | Modified | Add robots/hreflang fields |
| `apps/front/modules/cms/` | Modified | SEO composables, JSON-LD factory, nuxt-seo config |
| `apps/front/nuxt.config.ts` | Modified | SSG static generation rules |
| `package.json` (back & front) | Modified | Add nuxt-seo if not present |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking existing SEO meta on published pages | Medium | Only add nullable fields, preserve existing data |
| i18n route conflict with nuxt-seo hreflang | Low | Test hreflang output after integration |

## Rollback Plan

1. Revert `BlogPostEntity` migration (remove categoryId column)
2. Remove nullable SEO fields (robots, hreflang)
3. Revert nuxt.config.ts SSG changes
4. No data migration needed — all changes are additive

## Dependencies

- `@nuxtjs/robots` already installed (unconfigured)
- `nuxt-seo` already installed (unconfigured with i18n)
- User must provide localized route patterns for hreflang

## Success Criteria

- [ ] nuxt-seo outputs valid hreflang `<link>` tags for all locales
- [ ] BlogPost has exactly one Category and N Tags in database
- [ ] JSON-LD schema factory generates typed schemas (Article, BreadcrumbList, Organization)
- [ ] `nuxt generate` produces static HTML for all CMS routes
- [ ] Robots meta tag configurable per page/post via CMS admin
