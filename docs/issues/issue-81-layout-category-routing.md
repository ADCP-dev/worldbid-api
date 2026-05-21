---
id: "issue-81-layout-routing"
name: "CMS Layout Separation & Category Routing"
type: "research"
parent: "cms"
dependencies: ["auth", "cms"]
---

# Issue #81 — Layout Separation & Category Routing

## Overview

Dos problemas de arquitectura identificados post-auditoría SEO (issue #80):

1. **Layout compartido**: landing page y blog comparten el mismo layout, lo que limita personalización visual y SEO estructural entre secciones con audiencias distintas.
2. **Category routing**: las categorías usan query params con UUID (`/blog?categoryId=ada69fce-3e9d-4bcd-b217-9626808b39cf`) en vez de una ruta semántica basada en slug.

---

## 1. Layout Separation

### Problema actual
- Landing page (`/`) y blog (`/blog`) comparten el mismo layout Nuxt
- Landing es página de venta/marketing. Blog es contenido editorial. Tienen audiencias, jerarquías visuales y necesidades de navegación distintas.
- Forzar el mismo layout limita:
  - Header/footer diferenciados por sección
  - SEO estructural (landing no debería tener sidebar de blog, blog no debería tener CTA de venta en el hero)
  - Metadata y structured data por sección

### Solución propuesta
Usar **Nuxt Layouts** (`layouts/`) con `definePageMeta` para asignar layouts distintos:

```
layouts/
├── default.vue       # Layout genérico (fallback)
├── landing.vue       # Layout para landing page (/)
│   ├── Hero section
│   ├── Features
│   ├── Pricing/CTA
│   └── Minimal footer
└── cms.vue           # Layout para CMS público (/blog, /page, /blog/category)
    ├── Blog header con búsqueda
    ├── Sidebar (opcional)
    ├── Breadcrumbs automáticos
    └── Footer con navegación de contenido
```

**Páginas afectadas:**

| Página | Layout actual | Layout propuesto |
|--------|---------------|------------------|
| `/` (landing) | `default` | `landing` |
| `/blog` | `default` | `cms` |
| `/blog/[slug]` | `default` | `cms` |
| `/blog/category/[slug]` | `default` | `cms` |
| `/page/[slug]` | `default` | `cms` |

**Beneficios:**
- SEO: cada sección tiene su propia jerarquía HTML semántica
- UI: landing puede tener diseño bold/visual, blog puede ser lectura-optimizado
- Mantenibilidad: layouts separados = cambios aislados sin regresiones

---

## 2. Category Routing (URL Semántica)

### Problema actual
Las categorías se filtran vía query param con UUID:

```
/blog?categoryId=ada69fce-3e9d-4bcd-b217-9626808b39cf
```

**Problemas:**
- **SEO**: UUID en URL no aporta keywords, Google no indexa bien query params como páginas separadas
- **UX**: URL no legible, no compartible, no memorable
- **Crawling**: los crawlers tratan query params como la misma página con filtro, no como página distinta
- **Breadcrumbs**: difíciles de armar con query params

### Solución propuesta
Ruta semántica con slug de categoría:

```
/blog/c/{category-slug}
```

**Alternativas evaluadas:**

| Ruta | Pros | Contras |
|------|------|---------|
| `/blog/c/{slug}` | Corto, claro, consistente con `/blog/category/[slug]` actual | `/c/` puede ser poco descriptivo |
| `/blog/category/{slug}` | Totalmente descriptivo | Más largo, ya existe para single category |
| `/blog/tema/{slug}` | Español descriptivo | Solo funciona en español, i18n complicado |
| `/blog/topic/{slug}` | Inglés descriptivo | Mix de idiomas en URL |

**Recomendación:** `/blog/c/{slug}` — corto, funciona en ambos idiomas, no colisiona con ruta existente de single category (`/blog/category/[slug]`).

### Cambios necesarios

**Frontend:**
1. Crear `pages/blog/c/[slug].vue` — página de listado de posts por categoría via slug
2. Redirigir o eliminar query param `?categoryId=` del blog index
3. Actualizar `BlogPostCard` y links de categoría para usar `/blog/c/{slug}`
4. Actualizar `defineOgImage` y SEO metadata en la nueva ruta
5. Actualizar `sitemap` y `routeRules` para la nueva ruta

**Backend:**
1. Endpoint: `GET /api/v1/cms/categories?slug={slug}` — obtener categoría por slug (ya puede existir)
2. Endpoint: `GET /api/v1/cms/posts?categorySlug={slug}` — posts filtrados por slug de categoría
3. Verificar que `Category` entity tenga campo `slug` único y genere slugs automáticamente

**i18n:**
- `/blog/c/{slug}` funciona en ambos locales (es, en)
- El slug de categoría puede ser el mismo en ambos idiomas o traducirse (decisión de diseño)

---

## Tech Notes

- **i18n actual**: `prefix_except_default` (es=default sin prefijo, en=/en/)
- **Rutas afectadas por i18n**: `/en/blog/c/{slug}` en inglés, `/blog/c/{slug}` en español
- **Layouts**: Nuxt 3 soporta `definePageMeta({ layout: 'cms' })` por página. También se puede usar `setPageLayout` en middleware.
- **Slug uniqueness**: los slugs de categoría deben ser únicos (database constraint). Evaluar si son multilingües (mismo slug ambos idiomas) o por locale (distinto slug es/en).

## Definition of Done (preliminar)
- [ ] Layout `landing.vue` creado y asignado a `/`
- [ ] Layout `cms.vue` creado y asignado a páginas CMS públicas
- [ ] Ruta `/blog/c/[slug]` funcional con listado de posts
- [ ] Links de categoría en blog index usan nueva ruta
- [ ] OG images y SEO en nueva ruta
- [ ] Sitemap incluye nuevas rutas de categoría
- [ ] Backend endpoint para categoría por slug (si no existe)
- [ ] `pnpm build` exitoso
