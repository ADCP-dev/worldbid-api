---
doc: astro-migration/06-migration-phases
title: "Fases de Migración"
status: draft
created: 2026-07-07
---

# Fases de Migración

## Principio

**Incremental, sin big-bang.** Cada fase desplegable y reversible. Nuxt admin no se rompe en ninguna fase.

```
Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4
Setup   Landing   Blog     Ecommerce Limpieza
                  +Pages             Nuxt
```

## Dependencias entre fases

```
0 ──> 1 ──> 2 ──> 4
              │
              └──> 3 (independiente, puede empezar después de 2)
```

- Fase 3 (ecommerce) puede empezar en paralelo a Fase 4 si equipo disponible.
- Fase 4 requiere Fase 2 completo (blog/pages ya en Astro).

---

## Fase 0 — Setup

**Objetivo**: infra lista para recibir migración.

### Entregables

- [ ] `apps/web/` creado con Astro + Tailwind 4 + DaisyUI 5
- [ ] `packages/ui/` creado con tokens (colores, tipografía, spacing, breakpoints)
- [ ] `packages/ui` exportando Tailwind preset + DaisyUI theme
- [ ] `apps/web` consume `@foundation/ui` (FR-026, FR-027)
- [ ] `astro.config.mjs` con integraciones (tailwind, vue, sitemap, rss, seo)
- [ ] `src/i18n/` con `es.json` + `en.json` base (FR-010)
- [ ] `astro:i18n` configurado (defaultLocale `es`, `prefix_except_default`) (FR-009)
- [ ] CI pipeline `apps/web` build (sin deploy aún) (FR-020)
- [ ] `pnpm-workspace.yaml` incluye `apps/web` + `packages/ui` (FR-028)

### Criterios de salida

- `pnpm --filter web build` produce `dist/` estático con landing placeholder (FR-019).
- `pnpm --filter @foundation/ui build` produce preset consumible (FR-026).
- Sin impacto en `apps/front` ni `apps/back`.
- `pnpm check-types` pasa en `apps/web` y `packages/ui` (NFR-010).

### Riesgos

- Conflictos versiones Tailwind/DaisyUI entre apps → fijar versiones compatibles (R7).

### Rollback

- Borrar `apps/web/` y `packages/ui/`. Revertir `pnpm-workspace.yaml`. Nuxt admin intacto.

---

## Fase 1 — Migrar landing

**Objetivo**: `modules/landing/` reescrito en Astro y desplegado en paralelo.

### Entregables

- [ ] 16 componentes `modules/landing/` reescritos en `.astro` (Hero, Pricing, FAQ, etc.) (FR-002)
- [ ] `apps/web/src/pages/index.astro` (landing) (FR-001)
- [ ] Layout `PublicLayout.astro` (navbar + footer) (FR-003)
- [ ] i18n strings UI para landing (es/en) (FR-010)
- [ ] SEO: meta tags, OG image, JSON-LD Organization (FR-014, FR-015, FR-016)
- [ ] Deploy Astro a staging (subdominio o path) (FR-020)
- [ ] Smoke test visual: landing Astro vs landing Nuxt, paridad razonable

### Criterios de salida

- Landing Astro sirve en staging (FR-001).
- Lighthouse: LCP < 2.5 s, 0 JS, CLS < 0.1 (NFR-001, NFR-002, NFR-003).
- Sin JS payload de auth/TanStack/i18n hook (NFR-002).
- Nuxt admin sigue sirviendo `/` en prod (aún no se cambia DNS).

### Riesgos

- Componentes Vue con lógica compleja → reescribir en Astro puede ser no trivial (R5).
- Diferencias visuales por Tailwind/DaisyUI versiones → validar tokens (R7).

### Rollback

- Desactivar deploy de staging. Nuxt admin sigue en prod sirviendo `/`. Sin impacto en usuarios.

---

## Fase 2 — Migrar blog + pages CMS

**Objetivo**: blog y `/page/**` servidos desde Astro.

### Entregables

- [ ] `/blog/index.astro`, `/blog/[slug].astro`, `/blog/c/[slug].astro`, `/blog/category/[slug].astro` (FR-004, FR-005)
- [ ] Fetch API NestJS en build para blog (FR-007) — endpoints `/api/v1/cms/blog/posts/public/**` (Q-008)
- [ ] `/page/[slug].astro` (fetch API NestJS en build) (FR-006, FR-011)
- [ ] Sitemap (`@astrojs/sitemap`) (FR-012, NFR-005)
- [ ] RSS (`@astrojs/rss`) (FR-013)
- [ ] JSON-LD: BlogPosting, BreadcrumbList (FR-015)
- [ ] OG images por post (FR-016)
- [ ] Invocar deploy hook existente de Coolify al publicar/editar (FR-021) — Q-009
- [ ] Deploy a prod (DNS `midominio.com` apunta a Astro) (FR-020)

### Criterios de salida

- `/blog/**` y `/page/**` servidos desde Astro en prod (FR-004, FR-006).
- Sitemap + RSS accesibles (FR-012, FR-013).
- Nuxt ya no sirve `/blog/**` ni `/page/**` (limpieza en Fase 4).
- Deploy hook Coolify funcional (FR-021).
- URLs consistentes con Nuxt (NFR-004).

### Riesgos

- Contenido stale si hook falla → cron fallback (R4, R8).
- Build acoplado backend → fallback graceful a estático (R3, NFR-007).

### Rollback

- Revertir DNS a Nuxt admin. Nuxt sigue sirviendo `/blog/**` y `/page/**` (aún no se han removido). Sin pérdida de datos.

---

## Fase 3 — Ecommerce parte pública (futuro)

**Objetivo**: extensión ecommerce, parte pública en Astro.

### Entregables

- [ ] `apps/web/src/pages/tienda/index.astro` (catálogo)
- [ ] `apps/web/src/pages/tienda/producto/[slug].astro` (detalle)
- [ ] `apps/web/src/components/islands/Carrito.vue` (island Vue)
- [ ] Checkout island (o redirect a gateway)
- [ ] Backend `extensions/ecommerce/` (NestJS, tablas `ext_ecommerce_*`)
- [ ] Admin `apps/front/extensions/ecommerce/` (Nuxt, `/app/ecommerce/**`)
- [ ] SEO: schema.org Product, Offer, Review, BreadcrumbList (FR-015)
- [ ] Filtros, búsqueda, paginación (Q-013: client-side sobre catálogo pre-cargado)

### Criterios de salida

- Catálogo servido estático con islands para carrito (FR-017).
- Admin gestiona productos/pedidos en Nuxt (FR-024).
- API NestJS expone endpoints ecommerce.

### Riesgos

- Carrito island con estado → complejidad SPA dentro de Astro (R9).
- SEO vs dinamismo (filtros server-side o estáticos).

### Rollback

- Desactivar rutas `/tienda/**` en Astro. Backend extension queda (no afecta admin). Decidir en Fase 3.

> Ver `09-ecommerce-future.md` para detalle.

---

## Fase 4 — Limpieza Nuxt

**Objetivo**: `apps/front/` queda como backoffice admin puro.

### Entregables

- [ ] `modules/landing/` removido (FR-022)
- [ ] `extensions/cms/pages/blog/` removido (FR-022)
- [ ] `extensions/cms/pages/page/` removido (FR-022)
- [ ] `nuxt.config.ts` `extends` limpio (sin `modules/landing`) (FR-023)
- [ ] `routeRules` simplificado (sin `/blog/**`, `/page/**`, `/`, `/en`) (FR-023)
- [ ] Alias `@landing` removido (FR-023)
- [ ] Verificación: `/app/**` funcional sin regresiones (FR-024)
- [ ] Auth pages (`/login`, `/register`, etc.) funcionales (FR-024)
- [ ] Pages error funcionales (FR-024)

### Criterios de salida

- `apps/front/` sin carpetas landing/blog/page públicas (FR-022).
- Backoffice 100% funcional (FR-024).
- Build Nuxt simplificado.
- `pnpm check-types` pasa (NFR-010).
- `pnpm lint` pasa (NFR-011).

### Riesgos

- Referencias residuales a `@landing` o rutas removed → grep + typecheck (R6).
- Auth pages dependían de landing layout → revisar layouts (R6).

### Rollback

- Revertir commit de limpieza. Nuxt admin vuelve a tener landing/blog/page (aunque ya no se usen en prod, Astro ya sirve eso). **No recomendado** — una vez Astro en prod, limpieza es safe.

---

## Timeline (estimación rough)

| Fase | Esfuerzo | Duración estimada |
|------|----------|-------------------|
| 0 | Setup infra | 1-2 días |
| 1 | Landing | 3-5 días (16 componentes) |
| 2 | Blog + pages | 3-5 días |
| 3 | Ecommerce | Por definir (feature nueva) |
| 4 | Limpieza Nuxt | 1 día |

> Estimaciones rough. Ajustar tras Fase 0.