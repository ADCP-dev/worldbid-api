---
id: "cms-audit"
name: "CMS Audit & Gap Analysis"
type: "extension"
parent: "cms"
dependencies: ["auth", "storage", "translations", "cms"]
conventions: []
entities: []
---

# CMS — Auditoría y Análisis de Brechas

> **Fecha**: 2026-04-30
> **Alcance**: Extensión CMS completa — backend + frontend
> **Objetivo**: Determinar qué funciona, qué falta, y qué está roto.

---

## 1. Resumen Ejecutivo

**Estado general: FUNCIONAL PERO CON GAPS.** La extensión CMS tiene la estructura correcta, entidades bien modeladas, y flujos básicos implementados. Sin embargo, tiene:

- **1 BUG crítico** (query a tabla con nombre viejo)
- **Funcionalidades documentadas pero no implementadas** (sitemap Nuxt module, BlogPosting JSON-LD type)
- **Hardcodeos que rompen en producción** (APP_URL, idiomas)
- **Sin tests en frontend**
- **SEO incompleto** — JSON-LD se guarda pero no hay flujo que lo genere automáticamente para todas las páginas

---

## 2. Arquitectura — Doc vs Realidad

| Componente | Doc (cms.md) | Realidad | Estado |
|-----------|-------------|----------|--------|
| Pages CRUD | ✅ | ✅ | Completo |
| Blog Posts CRUD | ✅ | ✅ | Completo |
| Categories CRUD | ✅ | ✅ | Completo |
| Tags CRUD | ✅ | ✅ | Completo |
| Media Upload | ✅ | ✅ | Completo |
| SEO Metadata | ✅ | ✅ | Completo |
| JSON-LD (BlogPosting) | ✅ `@type: BlogPosting` | ⚠️ Solo `Article` | Incompleto |
| JSON-LD (WebPage) | ✅ | ✅ | Completo |
| JSON-LD (WebSite) | ✅ | ✅ | Completo |
| JSON-LD (Organization) | No doc | ✅ | Extra |
| JSON-LD (BreadcrumbList) | No doc | ✅ | Extra |
| JSON-LD (Product) | No doc | ✅ | Extra |
| OG Tags | ✅ | ✅ | Completo |
| Twitter Cards | ✅ | ✅ | Completo |
| Robots meta | No doc | ✅ | Extra |
| Hreflang | No doc | ✅ | Extra |
| Sitemap auto-gen | ✅ `@nuxtjs/sitemap` | ⚠️ Solo API backend | Incompleto |
| SSR (pages) | ✅ | ✅ | Completo |
| SSG+SWR (blog) | ✅ | ⚠️ Config mínima | Parcial |
| Traducciones dinámicas | ✅ | ✅ | Completo |
| `page.name` como key | ✅ | ✅ | Completo |

---

## 3. Backend — Análisis Detallado

### 3.1 Entidades

#### PageEntity (`ext_cms_page`) — ✅ Completo

```
Columnas: id, name (unique), slug (non-unique), route, section (enum: landing|blog|documentation|store),
          order, parentId, isPublished, publishedAt, featuredImageId, authorId,
          createdAt, updatedAt, deletedAt
```

- `name`: campo UNIQUE que actúa como identificador estable para traducciones vía `category: "page.{name}"`
- `slug`: ahora es non-unique para permitir traducciones multilingües
- `section`: usa enum `PageSection` (landing|blog|documentation|store) — el doc dice `template: landing|generic|contact`. **Discrepancia** con la documentación.

**Doc dice:** `template: ENUM landing, generic, contact`
**Realidad:** `section: ENUM landing, blog, documentation, store`

#### BlogPostEntity (`ext_cms_blog_post`) — ✅ Completo

```
Columnas: id, slug (non-unique), isPublished, publishedAt, featuredImageId, authorId,
          categoryId (FK → blog_category), tags (M2M → post_tag)
```

#### BlogCategoryEntity (`ext_cms_blog_category`) — ✅ Completo

```
Columnas: id, name, slug, description, parentId
```

#### TagEntity (`ext_cms_post_tag`) — ✅ Completo

```
Columnas: id, name (unique)
```

#### SeoMetadataEntity (`ext_cms_seo_metadata`) — ✅ Completo

```
Columnas: id, pageId, lang, metaTitle, metaDescription, metaKeywords,
          ogImageId, canonicalUrl, ogTitle, ogDescription,
          customJsonLd (jsonb), type (WebPage|Article|WebSite),
          robotsPolicy (jsonb), hreflangEnabled, hreflangAlternateLocales,
          hreflangCustomUrls (jsonb)
```

**⚠️ Solo tiene `pageId`** — no tiene `postId`. El doc menciona ambos. En la práctica, el backend usa `pageId` tanto para páginas como para posts, lo cual funciona pero es semánticamente confuso.

### 3.2 Sistema JSON-LD — ✅ Robusto

El backend tiene un sistema completo de JSON-LD con:

1. **Schema Registry** (`json-ld.registry.ts`) — singleton con factories por tipo
2. **Factories** (`json-ld.factories.ts`) — generan schemas para 6 tipos:
   - `Article` — para blog posts (⚠️ debería ser `BlogPosting`)
   - `Organization` — datos del sitio
   - `BreadcrumbList` — navegación
   - `WebPage` — páginas genéricas
   - `WebSite` — sitio completo
   - `Product` — productos
3. **TypeScript types** — interfaces tipadas para cada schema + inputs

### 3.3 Integración con Traducciones

**Dos patrones de linking:**

| Entidad | Patrón | Ejemplo |
|---------|--------|---------|
| Page | `category: "page.{name}"` | `page.home`, `page.about` |
| BlogPost | `entityName: "BlogPost"` + `entityId: uuid` | entityName='BlogPost', entityId='abc-123' |

La `TranslationEntity` tiene los campos: `section`, `key`, `content`, `entityName`, `entityId`, `category`, `lang`.

**Flujo de traducciones para páginas:**
1. Page se crea con `name` (único, estable)
2. Las traducciones se guardan con `category: "page.{name}"`, `section: "page"`, y `key` = campo a traducir (`title`, `content`, `excerpt`, `slug`, `metaTitle`, `metaDescription`)
3. `loadTranslationsForPages()` busca todas las traducciones con `category IN (page.names)` y las agrupa por page.id + langCode
4. Los slugs traducidos se resuelven en `findBySlugPublic()` buscando `key: 'slug'` en traducciones

### 3.4 SeoService — Lógica de Resolución

```
findByPageId(pageId, lang):
  1. Busca SeoMetadataEntity por pageId + lang
  2. Si no tiene metaTitle/Description → resolveMetaFromTranslations()
  3. resolveMetaFromTranslations():
     a. Intenta BlogPost: getTranslationsForEntity('BlogPost', pageId, lang)
     b. Si no, intenta Page: SELECT name FROM "page" WHERE id = $1  ← BUG
     c. Si encuentra page: getTranslationsForCategory('page.{name}', lang)
  4. Retorna SeoMetadata (o virtual si no existe en DB)
```

### 3.5 Sitemap — ✅ Backend, ❌ Frontend

- **Backend**: `SitemapService` genera URLs para blog posts y páginas con alternates multilingües
- **Frontend**: NO hay integración con `@nuxtjs/sitemap`. El `nuxt.config.ts` de la capa CMS está vacío — no configura sitemap module.

**Problema**: Los endpoints `/api/v1/sitemap/blog` y `/api/v1/sitemap/pages` existen, pero nadie los consume. Nuxt no está generando `sitemap.xml`.

### 3.6 Tests

7 archivos de test:
- `categories.service.spec.ts`
- `pages.service.spec.ts`
- `pages.controller.spec.ts`
- `tags.service.spec.ts`
- `create-category.dto.spec.ts`
- `sitemap.controller.spec.ts`
- `seo.service.spec.ts`

**Faltan**: tests para `PostsService`, `MediaController`, `SeoController`, `JsonLdSchemaRegistry`, `json-ld.factories`.

---

## 4. Frontend — Análisis Detallado

### 4.1 Páginas Públicas (SEO)

#### `(public)/[lang]/page/[slug].vue` — SSR ✅

- Fetch a `GET /api/v1/cms/pages/public/{slug}`
- Fetch a `GET /api/v1/translations/dynamic/{lang}/Page/{id}`
- Fetch a `GET /api/v1/cms/seo/{id}?lang={lang}`
- Renderiza `CmsSeoMeta` con `type="WebPage"`
- JSON-LD se renderiza SOLO si `seo.customJsonLd` existe (viene del backend, no se genera en frontend)

#### `(public)/[lang]/blog/[slug].vue` — SSG+SWR ✅

- Fetch a `GET /api/v1/cms/blog/posts/public/{slug}`
- Fetch a `GET /api/v1/translations/dynamic/{lang}/BlogPost/{id}`
- Fetch a `GET /api/v1/cms/seo/{id}?lang={lang}`
- Renderiza `CmsSeoMeta` con `type="Article"`
- Muestra author, fecha, tags, featured image

#### `(public)/[lang]/blog/index.vue` — Blog listing

Lista de posts publicados. Sin SEO específico más allá del layout.

### 4.2 CmsSeoMeta — Componente SEO Completo ✅

Este componente inyecta vía `useHead()`:

| Categoría | Tags |
|-----------|------|
| Meta básico | `title`, `meta[name=description]` |
| Open Graph | `og:title`, `og:description`, `og:image`, `og:type`, `og:locale` |
| Twitter Cards | `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` |
| Robots | `meta[name=robots]` con política completa (index/follow, max-image-preview, etc.) |
| Hreflang | `link[rel=alternate][hreflang]` para todos los locales + x-default |
| Canonical | `link[rel=canonical]` |
| **JSON-LD** | `<script type="application/ld+json">` con `customJsonLd` si existe |

### 4.3 JSON-LD en Frontend

El frontend tiene una duplicación completa del sistema de JSON-LD del backend:

- `types/json-ld.ts` — mismas interfaces que el backend
- `utils/json-ld.ts` — mismas factory functions
- `composables/useSchema.ts` — gestor de schemas para uso programático
- `components/cms/SchemaOrg.vue` — componente para renderizar schemas vía useHead

**⚠️ Problema**: Los templates públicos NO usan `useSchema` para generar JSON-LD en el frontend. Dependen 100% de `customJsonLd` que viene del backend. Esto significa que:
- Si no se guardó SEO metadata con JSON-LD en backend → no hay JSON-LD en frontend
- El pipeline backend debería generar `customJsonLd` al hacer upsert del SEO

### 4.4 Panel de Administración

Implementado: Pages (CRUD + reorder), Blog Posts (CRUD + preview + publish), Categories, Tags, Media.

**CmsSeoCard** — UI para editar SEO:
- Meta title, meta description, meta keywords (con multi-select)
- OG image upload (usa `/api/v1/cms/media/upload`)
- Canonical URL
- JSON-LD type selector (WebPage | Article | WebSite)

### 4.5 Sitemap Frontend

**❌ NO IMPLEMENTADO.** El doc dice que usa `@nuxtjs/sitemap` con backend sources, pero:
- `nuxt.config.ts` de la capa CMS no importa `@nuxtjs/sitemap`
- No hay configuración de sitemap en `nuxt.config.ts` raíz
- Los endpoints `/api/v1/sitemap/*` no son consumidos por el frontend

### 4.6 Tests Frontend

**❌ CERO tests.** No hay un solo archivo `.test.ts` o `.spec.ts` en `apps/front/modules/cms/`.

---

## 5. BUGS Encontrados

### 🐛 BUG #1 (CRÍTICO): SeoService query usa nombre de tabla viejo

**Archivo**: `apps/back/src/extensions/cms/seo/seo.service.ts:78`
```typescript
// ❌ MAL — la tabla se renombró a ext_cms_page
const pageResult = await this.dataSource.query(
  `SELECT name FROM "page" WHERE id = $1 LIMIT 1`,
  [pageId],
);
```

**Debe ser**:
```typescript
// ✅ BIEN
const pageResult = await this.dataSource.query(
  `SELECT name FROM "ext_cms_page" WHERE id = $1 LIMIT 1`,
  [pageId],
);
```

**Impacto**: `resolveMetaFromTranslations()` falla silenciosamente para páginas. El método siempre retorna `{}` en la rama Page, así que el SEO de páginas nunca resuelve metaTitle/metaDescription desde traducciones. Solo funciona si existe un `SeoMetadataEntity` con los campos ya poblados.

**Severidad**: Alta. SEO de páginas CMS no está resolviendo traducciones correctamente.

### 🐛 BUG #2: APP_URL hardcodeado

**Archivos**:
- `apps/back/src/extensions/cms/seo/infrastructure/schemas/json-ld.factories.ts:16` — `const APP_URL = process.env.APP_URL || 'https://example.com'`
- `apps/front/modules/cms/utils/json-ld.ts:24` — `const APP_URL = 'https://example.com'`

En frontend, usa `config.public.appUrl` en `CmsSeoMeta` pero NO en `utils/json-ld.ts`.

**Impacto**: JSON-LD generado con `generateSchema()` en frontend usa URLs de ejemplo.

### 🐛 BUG #3: Sitemap idiomas hardcodeados

**Archivo**: `apps/back/src/extensions/cms/sitemap/sitemap.service.ts:33`
```typescript
const langs = ['es', 'en']; // Hardcodeado
```

**Impacto**: Si se agregan más idiomas, no aparecen en el sitemap. Debería leerlos de `LangEntity` (translations module).

---

## 6. FEATURES FALTANTES

### 🔴 F1: Sitemap XML en Frontend (Crítico para SEO)

**Qué falta**: Integración de `@nuxtjs/sitemap` que consuma los endpoints `/api/v1/sitemap/blog` y `/api/v1/sitemap/pages`.

**Plan**:
1. Instalar `@nuxtjs/sitemap` en la capa CMS o en la app principal
2. Configurar `sitemap.sources` para que llame a los endpoints del backend
3. Verificar que se genera `/sitemap.xml`

### 🔴 F2: JSON-LD BlogPosting type

**Qué falta**: El tipo `BlogPosting` de schema.org, que es más específico que `Article` y recomendado por Google.

**Plan**:
1. Agregar `BlogPosting` al `SchemaType` union
2. Crear `BlogPostingSchema` interface + `BlogPostingSchemaInput`
3. Agregar `createBlogPostingSchema` factory (→ extiende Article con `@type: 'BlogPosting'`)
4. Agregar al registry
5. Actualizar `CmsSeoCard` para ofrecer `BlogPosting` como opción

### 🟡 F3: JSON-LD automático en flujo de publicación

**Qué falta**: Al publicar una página o post, el backend debería generar automáticamente `customJsonLd` basado en los datos de la entidad + SEO.

**Actualmente**: Solo genera JSON-LD si `updateSeoDto.type` viene populado (upsert manual). Si el admin no toca SEO, no hay JSON-LD.

**Plan**:
1. En `PagesService.publish()` y `BlogPostsService.publish()`, llamar a `SeoService.upsert()` con type apropiado
2. O: Hacer que `CmsSeoMeta` genere JSON-LD en frontend con `useSchema` si no viene del backend

### 🟡 F4: Tests frontend

Cero tests. Mínimo necesario:
- `CmsSeoMeta` — verificar que inyecta meta tags correctos
- `SchemaOrg` — verificar que renderiza JSON-LD scripts
- `useSchema` — verificar addSchema/getSchemasJson
- `useSeo` — verificar buildHreflangLinks, buildRobotsContent

### 🟡 F5: Reconciliar doc vs realidad — Page.section vs Page.template

El doc dice `template: landing|generic|contact`. La entidad tiene `section: landing|blog|documentation|store`.

**Decisión pendiente**: ¿Cuál es el correcto? Ambos tienen sentido pero hay que alinear documentación o código.

### 🟢 F6: SeoMetadata.postId

La entidad solo tiene `pageId`. El doc menciona `postId`. La ambigüedad actual funciona (pageId se usa para ambos) pero es confusa.

**Plan**: Agregar `postId` nullable a `SeoMetadataEntity` y hacer el query con `WHERE pageId = $1 OR postId = $1`.

---

## 7. Fortalezas del Sistema

1. **JSON-LD Registry Pattern** — bien diseñado, extensible, con factories tipadas
2. **Traducciones multilingües vía category/entityName** — patrón limpio que escala
3. **`page.name` como key estable** — permite cambiar slugs sin romper traducciones
4. **CmsSeoMeta component** — cobertura completa de meta tags (OG, Twitter, robots, hreflang, canonical, JSON-LD)
5. **Extension manifest** — bien documentado con rutas, permisos, entidades
6. **Delete cascade** — limpieza de archivos al borrar páginas/posts
7. **Preview system** — posts en borrador tienen preview endpoint que ignora isPublished

---

## 8. Recomendaciones Priorizadas

### 🔴 Crítico (debe fixearse ya)

1. **Fix BUG #1**: Query a `ext_cms_page` en vez de `page`
2. **Fix BUG #2**: Usar `config.public.appUrl` en `utils/json-ld.ts`

### 🟠 Alto (próximo sprint)

3. **Implementar F1**: Sitemap XML con `@nuxtjs/sitemap`
4. **Implementar F2**: `BlogPosting` JSON-LD type
5. **Fix BUG #3**: Idiomas dinámicos en sitemap

### 🟡 Medio

6. **Implementar F4**: Tests frontend
7. **Implementar F3**: JSON-LD automático al publicar
8. **Fix F5/F6**: Alinear documentación con código

### 🟢 Bajo

9. Agregar tests para `PostsService`, `MediaController`, `JsonLdSchemaRegistry`
10. Migrar `process.env.APP_URL` a `ConfigService` en `json-ld.factories.ts`

---

## 9. Conclusión

El CMS está **operacional en su núcleo**: creás páginas, posts, categorías, subís media, gestionás SEO básico. Las traducciones multilingües funcionan con el patrón `page.{name}` / `entityName+entityId`.

**Lo que IMPIDE producción con SEO completo:**
- El sitemap XML no se genera (F1)
- El JSON-LD `BlogPosting` de Google no existe (F2)
- El bug de query a tabla vieja rompe resolución de SEO para páginas (BUG #1)

**Lo que es "nice to have" pero no blocker:**
- JSON-LD automático al publicar (se puede hacer manual vía admin)
- Tests frontend (el admin funciona manualmente)
- Alinear docs

**En resumen**: ~80% completo. Con 3 fixes (BUG #1, F1, F2) llega a producción-ready para SEO.
