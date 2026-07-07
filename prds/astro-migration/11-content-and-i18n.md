---
doc: astro-migration/11-content-and-i18n
title: "Estrategia de Contenido e i18n"
status: draft
created: 2026-07-07
updated: 2026-07-07
---

# Estrategia de Contenido e i18n

Unifica contenido (blog, pages CMS, landing) e i18n para `apps/web/` (Astro). CMS (NestJS) es fuente única de verdad para TODO el contenido.

## Fuente única: API NestJS (Q-003 resuelto)

| Tipo | Origen | Approach |
|------|--------|----------|
| Blog editorial | NestJS DB (admin crea/edita) | Fetch API en build time |
| Páginas CMS | NestJS DB (admin crea/edita) | Fetch API en build time (FR-006) |
| Landing | Componentes Astro estáticos | Directo en `.astro` (FR-001, FR-002) |

> Q-003 resuelto: NO content collections. NO markdown en repo. CMS es fuente única. Build acoplado a backend (R3 aceptado).

## Endpoints CMS públicos (Q-008 verificados)

Astro consume estos endpoints públicos en build time:

| Endpoint | Uso Astro build |
|----------|-----------------|
| `GET /api/v1/cms/blog/posts/public` | Listar posts publicados |
| `GET /api/v1/cms/blog/posts/public/category/:categoryId` | Posts por categoría |
| `GET /api/v1/cms/blog/posts/public/:slug` | Detalle post por slug |
| `GET /api/v1/cms/blog/posts/public/:slug/related` | Posts relacionados |
| `GET /api/v1/cms/blog/categories/public` | Listar categorías |
| `GET /api/v1/cms/blog/categories/public/by-slug/:slug` | Categoría por slug |
| `GET /api/v1/cms/blog/tags/public` | Listar tags |
| `GET /api/v1/cms/pages/public` | Listar páginas publicadas |
| `GET /api/v1/cms/pages/public/:slug` | Detalle página por slug |
| `GET /api/v1/sitemap/blog` | Sitemap blog |
| `GET /api/v1/sitemap/pages` | Sitemap pages |

> Q-008 resuelto: endpoints verificados en `apps/back/src/extensions/cms/`. Rutas `/public` sin auth.

## SEO automatizado (FR-012 a FR-016)

| Elemento | Tool | Output |
|----------|------|--------|
| Sitemap | `@astrojs/sitemap` | `sitemap-index.xml` + `sitemap-0.xml` |
| RSS | `@astrojs/rss` | `rss.xml` (blog) |
| Meta tags | `astro-seo` | `<title>`, `<meta description>`, OG, Twitter |
| Schema.org | JSON-LD manual o lib | Article, BlogPosting, BreadcrumbList, Organization |
| OG images | `astro-og-image` o Satori | PNG dinámica por post |

### JSON-LD — tipos por página (FR-015)

| Página | Schema |
|--------|--------|
| `/` | `Organization`, `WebSite` |
| `/blog` | `Blog` |
| `/blog/[slug]` | `BlogPosting`, `BreadcrumbList` |
| `/page/[slug]` | `WebPage` |
| `/tienda/**` (futuro) | `Product`, `Offer`, `Review`, `BreadcrumbList` |

## i18n — estado actual (Nuxt)

- `@nuxtjs/i18n` v10.2.3, strategy `prefix_except_default`, defaultLocale `es`.
- Hook `i18n:registerModule` fetchea `${API_URL}/api/v1/translations/langs` en **startup runtime**.
- Build acoplado a DB.

## i18n — target (Astro, Modo B) — Q-005 resuelto

| Aspecto | Decisión |
|---------|----------|
| Framework | `astro:i18n` nativo (FR-009) |
| Strings UI | Fetch a módulo de traducciones de NestJS en **build time** (FR-010) |
| Contenido CMS traducido | Fetch API NestJS por locale en build time (FR-011) |
| Estrategia routing | `prefix_except_default` (consistencia con Nuxt) — `es` sin prefijo, `/en/...` con prefijo (FR-009) |

> Q-005 resuelto: Modo B (build-time fetch backend). NO Modo A estático puro. Build acoplado a backend (R3 aceptado). Fallback a estático es/en si API cae (NFR-007).

## Estructura de archivos i18n

```
apps/web/src/i18n/
├── ui.ts              # loader: fetch strings UI desde NestJS en build
├── es.json            # fallback estático es (NFR-007)
├── en.json            # fallback estático en (NFR-007)
└── locales.json       # locales soportados (es, en + dinámicos desde fetch)
```

## Diferencia con Nuxt i18n

| Aspecto | Nuxt (actual) | Astro (target) |
|---------|---------------|----------------|
| Registro idiomas | Runtime (hook startup) | Build time (fetch) |
| Dependencia backend | Sí (startup) | Sí (build) |
| Routing | `prefix_except_default` | `prefix_except_default` (mismo) |
| Lazy loading | Sí (runtime) | N/A (build genera todo) |
| Strings UI | JSON + fetch backend | Fetch backend en build time (FR-010) |
| Traducciones CMS | Fetch backend runtime | Fetch backend en **build time** (FR-011) |

## Traducciones que vienen de DB — FR-010, FR-011

| Contenido | Approach |
|-----------|----------|
| Strings UI (nav, footer, botones) | Fetch a `extensions/translations/` en build time, con fallback estático es/en |
| Blog posts | Fetch API NestJS en build time, generar HTML por locale |
| Páginas CMS (`/page/**`) | Fetch API NestJS en build time, generar HTML por locale (FR-011) |

Para páginas CMS con traducciones: en build, Astro fetchea `/api/v1/cms/pages/public?lang=es` y `/api/v1/cms/pages/public?lang=en`, genera rutas estáticas por locale.

## Config Astro i18n (referencia)

```js
// astro.config.mjs
export default defineConfig({
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],  // populados dinámicamente en build desde fetch
    routing: { prefixDefaultLocale: false },
  },
})
```

> Modo B: `locales` se popula dinámicamente en build desde fetch a `/api/v1/translations/langs`.

## Regeneración de build (contenido stale — R4)

Si contenido CMS cambia en DB, el sitio estático queda stale hasta próximo build.

| Opción | Mecanismo |
|--------|-----------|
| Deploy hook Coolify (recomendado, FR-021) | NestJS invoca deploy hook de Coolify al publicar/editar |
| Manual | Botón en admin Nuxt → trigger Coolify |
| Cron | Build programado (fallback) |

> Q-009 resuelto: deploy hook ya existe en Coolify. Sin código nuevo de webhook.

## RSS — FR-013

```ts
// apps/web/src/pages/rss.xml.ts
import rss from '@astrojs/rss'
import { fetchBlogPosts } from '../lib/api'

export async function GET(context) {
  const posts = await fetchBlogPosts()  // fetch NestJS en build
  return rss({
    title: 'Foundation Blog',
    description: '...',
    site: context.site,
    items: posts.map(post => ({
      title: post.title,
      pubDate: post.pubDate,
      link: `/blog/${post.slug}`,
    })),
  })
}
```

## Sitemap — FR-012, NFR-005

Configurado via `@astrojs/sitemap` integration en `astro.config.mjs`. Auto-genera con todas las rutas estáticas + dinámicas (getStaticPaths).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| R3 Build acoplado a backend (Modo B) | Fallback a estático es/en si fetch falla (NFR-007) |
| R4 Contenido stale tras edición CMS | Deploy hook Coolify (FR-021) + cron fallback |
| i18n Astro menos maduro que Nuxt i18n | Scope limitado (web pública), strings UI simples (FR-010) |