---
doc: astro-migration/07-open-questions
title: "Preguntas Abiertas (Q-NNN) — Resueltas"
status: resolved
created: 2026-07-07
updated: 2026-07-07
---

# Preguntas Abiertas (Q-NNN) — RESUELTAS

Las 15 open questions fueron revisadas y resueltas por el usuario. Cada Q documenta decisión final, razón técnica e impacto resuelto.

## Bloqueantes

### ✅ Q-001: Hosting final para Astro — RESUELTA

**Decisión**: Coolify (self-hosted PaaS sobre VPS + Docker). No Cloudflare Pages, Vercel ni Netlify.

**Razón**: self-hosted, sin agentes externos, control total. Mismo VPS o uno dedicado puede servir Astro estático vía Coolify + Nginx reverse proxy.

**Implementación**: `10-deploy-and-infra.md` refleja Coolify. Astro deploy = Coolify servicio estático o Docker container sirviendo `dist/`.

**Resuelve**: bloqueante Fase 1 deploy. Determina topología de hosting.

---

### ✅ Q-002: Dominio vs subdominio para admin — RESUELTA

**Decisión**: Subdominio `app.midominio.com` para admin. Astro en `midominio.com`, API en `api.midominio.com`.

**Razón**: separación total, cookies scoped, CORS claro, deploy independiente por subdominio.

**Implementación**: DNS config en Fase 2 (deploy a prod).

**Resuelve**: bloqueante Fase 2 deploy a prod.

---

### ✅ Q-015: Owner del PRD — RESUELTA

**Decisión**: el usuario es owner del PRD y responsable de aprobar fases.

**Razón**: proyecto personal, una sola persona decide.

**Implementación**: N/A. El usuario aprueba cada fase antes de ejecutar.

**Resuelve**: bloqueante para iniciar cualquier fase.

---

## No-bloqueantes

### ✅ Q-003: Blog por API vs content collections — RESUELTA

**Decisión**: Blog por API NestJS. CMS es fuente única de verdad para TODO el contenido (blog + pages). NO content collections, NO markdown en repo.

**Razón**: mantener una sola fuente de contenido. Admin Nuxt ya gestiona blog en CMS. Duplicar a markdown en repo genera drift y sync manual.

**Implementación**: `11-content-and-i18n.md` remueve content collections. `03-requirements.md` actualiza FR-007. `06-migration-phases.md` Fase 2 solo fetchea API.

**Resuelve**: approach de contenido unificado. Build acoplado a backend (R3 aceptado).

---

### ✅ Q-004: Migración auth a httpOnly cookie — RESUELTA

**Decisión**: Sí, migrar auth a httpOnly cookies en paralelo a migración Astro.

**Razón**: seguridad (R1). `localStorage` es vulnerable a XSS. Cookies httpOnly mitigan.

**Implementación**: NestJS debe exponer endpoint `/api/v1/auth/login` que setee cookie httpOnly. Nuxt + Astro consumen.

**Resuelve**: R1 mitigado. Login server-mediated (no client-side puro).

---

### ✅ Q-005: Estrategia i18n final — RESUELTA

**Decisión**: Modo B — build-time fetch al módulo de traducciones de NestJS. NO estático puro (Modo A descartado).

**Razón**: strings UI y contenido traducido vienen del módulo de traducciones (`extensions/translations/`). Build acoplado a backend en build time (R3 aceptado).

**Implementación**: `11-content-and-i18n.md` cambia Modo A por Modo B. `03-requirements.md` actualiza FR-009, FR-010, FR-011. `04-context.md` actualiza supuestos.

**Resuelve**: i18n dinámico desde DB. Fallback a estático es/en si API cae (NFR-007).

---

### ✅ Q-006: Stack de islands — RESUELTA

**Decisión**: Vue 3 para islands Astro.

**Razón**: consistencia con Nuxt admin (mismo lenguaje, share de lógica pura posible).

**Implementación**: `@astrojs/vue` integration en `astro.config.mjs`.

**Resuelve**: stack de islands definido.

---

### ✅ Q-007: Versionado de `packages/ui` — RESUELTA

**Decisión**: Workspace interno con `tsup` build. Sin publish a npm.

**Razón**: monorepo único, un solo consumidor. `tsup` más rápido que `tsc` para bundles.

**Implementación**: `packages/ui` declarado `workspace:*` en `pnpm-workspace.yaml`. Build con `tsup`.

**Resuelve**: mecanismo de distribución de tokens.

---

### ✅ Q-008: Endpoints CMS públicos en NestJS — VERIFICADA

**Tipo**: Hallazgo técnico (no decisión). Endpoints públicos confirmados vía inspección de controllers en `apps/back/src/extensions/cms/`.

**Endpoints públicos confirmados** (rutas `/public` sin auth):

| Endpoint | Controller | Uso Astro build |
|----------|------------|-----------------|
| `GET /api/v1/cms/blog/posts/public` | `posts.controller.ts:59` | Listar posts publicados |
| `GET /api/v1/cms/blog/posts/public/category/:categoryId` | `posts.controller.ts:84` | Posts por categoría |
| `GET /api/v1/cms/blog/posts/public/:slug` | `posts.controller.ts:94` | Detalle post por slug |
| `GET /api/v1/cms/blog/posts/public/:slug/related` | `posts.controller.ts:100` | Posts relacionados |
| `GET /api/v1/cms/blog/categories/public` | `categories.controller.ts:46` | Listar categorías |
| `GET /api/v1/cms/blog/categories/public/by-slug/:slug` | `categories.controller.ts:51` | Categoría por slug |
| `GET /api/v1/cms/blog/tags/public` | `tags.controller.ts:45` | Listar tags |
| `GET /api/v1/cms/pages/public` | `pages.controller.ts:47` | Listar páginas publicadas |
| `GET /api/v1/cms/pages/public/:slug` | `pages.controller.ts:56` | Detalle página por slug |
| `GET /api/v1/sitemap/blog` | `sitemap.controller.ts:10` | Sitemap blog |
| `GET /api/v1/sitemap/pages` | `sitemap.controller.ts:15` | Sitemap pages |

**Razón**: rutas `/public` existen en controllers y sirven contenido publicado sin auth. Astro consume en build time.

**Implementación**: `11-content-and-i18n.md` actualiza tabla de endpoints. Q-008 deja de ser `[NEEDS CLARIFICATION]`.

**Resuelve**: dependencia de Fase 2 (blog + pages Astro) satisfecha.

---

### ✅ Q-009: Webhook rebuild mecanismo — RESUELTA

**Decisión**: Deploy hook ya existe en Coolify. No implementar webhook nuevo.

**Razón**: Coolify maneja deploy hooks nativos. NestJS solo invoca el hook existente si necesita regenerar.

**Implementación**: `10-deploy-and-infra.md` remueve "implementar webhook rebuild". `06-migration-phases.md` Fase 2 invoca hook existente, no crea nuevo.

**Resuelve**: mecanismo de regeneración de build. Sin código nuevo.

---

### ✅ Q-010: Nuxt admin post-cleanup: SSR o SPA puro — RESUELTA

**Decisión**: SPA puro (`ssr: false`).

**Razón**: admin no necesita SSR. Sin SEO en backoffice. Deploy más simple.

**Implementación**: `nuxt.config.ts` con `ssr: false` + preset SPA en Fase 4.

**Resuelve**: configuración Nuxt post-limpieza.

---

### ✅ Q-011: Auth pages — Nuxt o Astro — RESUELTA

**Decisión**: Auth pages (`/login`, `/register`, `/forgot-password`, `/password-change`, `/login-basic`) se quedan en Nuxt.

**Razón**: forms interactivos, auth client-side. Con Q-004 (httpOnly cookies), login es server-mediated por Nuxt o NestJS endpoint, no Astro estático.

**Implementación**: N/A. No se migran.

**Resuelve**: ubicación de auth pages.

---

### ✅ Q-012: Ecommerce + Stripe existente — RESUELTA

**Decisión**: Reutilizar `extensions/stripe` para checkout.

**Razón**: DRY, un módulo billing. Evita duplicar integración Stripe.

**Implementación**: `extensions/ecommerce` delega checkout a `extensions/stripe`. Decidir en Fase 3.

**Resuelve**: arquitectura billing ecommerce.

---

### ✅ Q-013: Filtros y búsqueda ecommerce — RESUELTA

**Decisión**: Client-side filters sobre catálogo pre-cargado. Migrar a server-side cuando duela (si catálogo crece).

**Razón**: catálogo inicial chico. Simple, sin backend extra.

**Implementación**: `FiltrosCatalogo.vue` island. Migración a server-side deferred hasta que catálogo lo justifique.

**Resuelve**: approach filtros para Fase 3.

---

### ✅ Q-014: Dark mode — RESUELTA

**Decisión**: NO dark mode. Sin variantes light/dark en tokens.

**Razón**: scope reducido, simplicidad. Web pública y admin quedan en modo único.

**Implementación**: `packages/ui` exporta tokens sin variantes dark. `02-architecture.md` y `04-context.md` reflejan constraint. `09-ecommerce-future.md` sin dark mode.

**Resuelve**: alcance del design system. Tokens más simples.

---

## Resumen

| ID | Tema | Estado |
|----|------|--------|
| Q-001 | Hosting Astro | ✅ Coolify |
| Q-002 | Dominio/subdominio | ✅ Subdominios |
| Q-003 | Blog: API vs collections | ✅ API NestJS |
| Q-004 | Auth httpOnly cookie | ✅ Sí, paralelo |
| Q-005 | i18n Modo A vs B | ✅ Modo B (build-time fetch) |
| Q-006 | Stack islands | ✅ Vue 3 |
| Q-007 | Versionado `packages/ui` | ✅ Workspace + tsup |
| Q-008 | Endpoints CMS públicos | ✅ Verificados |
| Q-009 | Webhook rebuild | ✅ Hook Coolify existente |
| Q-010 | Nuxt SSR vs SPA | ✅ SPA puro |
| Q-011 | Auth pages ubicación | ✅ Nuxt |
| Q-012 | Ecommerce + Stripe | ✅ Reutilizar stripe |
| Q-013 | Filtros ecommerce | ✅ Client-side |
| Q-014 | Dark mode | ✅ Sin dark mode |
| Q-015 | Owner PRD | ✅ Usuario |