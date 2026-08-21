---
doc: astro-public/06-migration-phases
title: "Fases de Migración"
status: draft
created: 2026-08-20
---

# Fases de Migración

## Principio

**Incremental, sin big-bang.** Cada fase desplegable y reversible. Nuxt admin no se rompe en ninguna fase. 3 fases (no 5 como el draft).

```
Fase 0 → Fase 1 → Fase 2
Setup    Landing   Blog + Pages + ISR DIY
         +Contacto
```

## Dependencias entre fases

```
0 ──> 1 ──> 2
```

- Fase 1 requiere Fase 0 (infra lista).
- Fase 2 requiere Fase 1 (layout + contacto + landings funcionando).

---

## Fase 0 — Setup

**Objetivo**: infra lista para recibir migración. `apps/web/` Astro 7 creado y buildeable como SSR Node.

### Entregables

- [ ] `apps/web/` creado con Astro 7 + Tailwind 4 + DaisyUI 5 + adapter `@astrojs/node` (mode: standalone).
- [ ] `astro.config.mjs` con `output: 'server'` + `@astrojs/node` + integraciones: `@astrojs/tailwind`, `@astrojs/vue`, `@astrojs/sitemap`, `@astrojs/rss`, `astro-seo`.
- [ ] `routeRules` config skeleton en `astro.config.mjs`: `/` cache con `maxAge: 3600, swr: 60, tags: ['home']`; `/blog` y `/blog/**` con `maxAge: 300, swr: 60, tags: ['blog']`; `/page/**` con `maxAge: 600, swr: 60, tags: ['pages']`; `/blog/search` con `cache: false` — FR-039.
- [ ] `astro:i18n` configurado (defaultLocale `es`, `prefix_except_default`) — FR-014.
- [ ] `src/i18n/` con `es.json` + `en.json` base (fallback estático) — FR-015, NFR-007.
- [ ] `src/lib/api.ts` con helper `fetchApi(path, { lang })` que siempre añade `?lang=` (mecanismo primario) — FR-016.
- [ ] Layout base `PublicLayout.astro` (navbar + footer placeholder) — FR-003.
- [ ] Env vars wiring: `API_URL` (backend), `REVALIDATE_SECRET` (shared con backend, para webhook ISR), `PUBLIC_SITE_URL`, `ASTRO_URL` (en backend, para disparar webhook).
- [ ] Backend: actualizar `FRONTEND_DOMAINS` env var (CSV) para incluir dominio Astro — NFR-009.
- [ ] ISR endpoint skeleton: `src/pages/api/revalidate.ts` placeholder con verificación HMAC-SHA256 + timestamp < 5 min (FR-040, FR-041).
- [ ] `pnpm-workspace.yaml` ya soporta `apps/web/` (glob `apps/*`), verificar.
- [ ] Scripts en `apps/web/package.json`: `dev`, `build`, `preview`, `check-types`. Turborepo los detecta.
- [ ] CI pipeline `apps/web` build (sin deploy aún) — FR-051.
- [ ] Node mínimo 22.12.0 en CI + Coolify (Node 20 EOL April 2026) — `04-context.md`.

### Criterios de salida

- `pnpm --filter web build` produce `dist/server/entry.mjs` (proceso Node standalone) con landing placeholder — FR-050.
- `node ./dist/server/entry.mjs` arranca en puerto 4321 y sirve `/` (smoke test) — FR-050.
- `pnpm check-types` pasa en `apps/web` — NFR-010.
- `pnpm lint` pasa en `apps/web` — NFR-011.
- Sin impacto en `apps/front` ni `apps/back`.
- Endpoint `/api/revalidate` responde 401 sin firma válida o con timestamp expirado (test) — FR-041.
- `routeRules` cachea `/` (test: segunda request sirve cache, no re-fetch) — FR-039.

### Riesgos

- Conflictos versiones Tailwind/DaisyUI entre apps → fijar versiones compatibles.
- **Configuración incorrecta adapter `@astrojs/node` en Coolify** (start command, puerto) → seguir guía https://antonioleiva.com/astro-ssr-coolify, verificar en Fase 0 con build smoke test (start command `node ./dist/server/entry.mjs`, exponer puerto 4321, "Is it a static site?" unchecked).

> NOTa: NO hay riesgo "ISR adapter no soportado por Coolify → fallback full rebuild cron". Coolify soporta Astro SSR via Docker (verificado). El PRD previo incluía este riesgo falso — eliminado.

### Rollback

- Borrar `apps/web/`. Revertir `FRONTEND_DOMAINS`. Nuxt admin intacto.

---

## Fase 1 — Landing + Contacto

**Objetivo**: landing reescrita en Astro con formulario de contacto funcional. Extensión `web` backend creada (sin DB).

### Entregables — Frontend (Astro)

- [ ] Componentes `modules/landing/` reescritos en `.astro` en `apps/web/src/components/landing/` — FR-002.
- [ ] `apps/web/src/pages/index.astro` (landing) — FR-001.
- [ ] Landing fetchea CMS PageSection 'landing' via `GET /api/v1/cms/pages/public?lang=<locale>` — FR-006.
- [ ] i18n strings UI para landing (es/en) via `GET /api/v1/translations/exact-by-path?app=front&dotPath=<path>` — FR-015.
- [ ] SEO: meta tags, OG image, JSON-LD Organization + WebSite — FR-020, FR-021, FR-023.
- [ ] Island `ContactForm.vue` en `apps/web/src/components/islands/` con `client:visible` — FR-036, FR-024.
  - Campos: name, email, message, honeypot oculto (NFR-042).
  - Validación Zod client-side.
  - Submit a `POST /api/v1/contact`.
  - Estados: idle, loading, success (toast), error (mensaje localizado).
- [ ] Deploy Astro a staging (subdominio o path) via Coolify (Astro SSR Docker) — FR-051.
- [ ] Smoke test visual: landing Astro vs landing Nuxt, paridad razonable.

### Entregables — Backend (extensión `web`, SIN DB)

- [ ] `pnpm generate:extension -- --name=web` → crea `apps/back/src/extensions/web/` — FR-030.
- [ ] `extension.module.ts` auto-discovered (NO editar `app.module.ts`) — FR-030.
- [ ] Controller `web.controller.ts` con `POST /api/v1/contact` (sin guard, público) — FR-032.
- [ ] DTO `create-contact.dto.ts`: `{ name: string, email: string, message: string, lang?: string }` con class-validator — FR-032.
- [ ] `@Throttle(5, 60_000)` en el endpoint — FR-033.
- [ ] **SIN tablas DB** — los mensajes NO se persisten (FR-031). No crear tabla `ext_web_contact_message`, no crear migración. El endpoint valida DTO → envía email → responde 201 (o 500 si falla el envío).
- [ ] **Q-020 (inicio Fase 1)**: inspeccionar el directorio Maizzle existente en el backend (5 min) para confirmar ubicación exacta de `contact-notification.hbs`. Seguir patrón existente de MailService.
- [ ] `MailService.contactFormNotification(name, email, message, lang?)` añadido a `MailService` — FR-034. Try/catch que lanza excepción en fallo de envío (controller catch → 500, NO 201 silencioso — R-CONTACT-2).
- [ ] Plantilla Maizzle `contact-notification.hbs` creada (ubicación confirmada por Q-020) — FR-035.
- [ ] Reutiliza `app.notificationEmail` como destino — FR-034.
- [ ] Tests: unit (DTO validation, rate limit), integration (endpoint E2E con mock mail), test template render failure → 500 (no 201).

### Criterios de salida

- Landing Astro sirve en staging — FR-001.
- Lighthouse: LCP < 2.5 s, JS payload < 10 KB (ideal 0 KB salvo ContactForm island), CLS < 0.1 — NFR-001, NFR-002, NFR-003.
- Sin JS payload de auth/TanStack/i18n hook — NFR-002.
- POST /api/v1/contact con DTO válido → 201, email llega a `app.notificationEmail` — FR-032.
- POST /api/v1/contact con DTO válido pero SMTP caído / template render error → 500 (NO 201 silencioso) — FR-032, R-CONTACT-2.
- POST /api/v1/contact 6 veces en 60s → 6ª recibe 429 con `Retry-After` — FR-033.
- POST con honeypot relleno → 201 silencioso (descartado, NO se envía email) — NFR-042.
- POST con DTO inválido (email mal, mensaje vacío) → 400 — FR-032.
- Extensión `web` auto-discovered (verificar: backend arranca sin editar `app.module.ts`) — FR-030.
- **Verificar que NO existe tabla `ext_web_contact_message` ni migración de contacto** (FR-031).
- Nuxt admin sigue sirviendo `/` en prod (aún no se cambia DNS).

### Riesgos

- Componentes Vue con lógica compleja → reescribir en Astro puede ser no trivial (R5).
- MailService template render failure → test E2E verifica email llega + test template failure → 500 (R-CONTACT-2).
- Rate limit misconfiguration → test automático verifica 5/min (R-CONTACT-1).

### Rollback

- Desactivar deploy de staging. Nuxt admin sigue en prod sirviendo `/`. Sin impacto en usuarios.
- Extensión `web` queda en backend (no afecta a nada, sin tablas DB). Se puede desactivar el endpoint via feature flag si necesario.

---

## Fase 2 — Blog + Pages + ISR DIY + Sitemap

**Objetivo**: blog, páginas CMS, ISR DIY (purge por tag via `Astro.cache`) y sitemap centralizado en Astro. Deploy a prod.

### Entregables — Blog

- [ ] `/blog/index.astro` — lista posts paginados via `GET /api/v1/cms/blog/posts/public?lang=<locale>&page=<n>&limit=<n>` — FR-005, FR-007, FR-012.
- [ ] `/blog/[slug].astro` — detalle post + relacionados via `GET /api/v1/cms/blog/posts/public/:slug/related?limit=3` — FR-005, FR-008.
- [ ] `/blog/c/[slug].astro` + `/blog/category/[slug].astro` — filtro categoría via `GET /api/v1/cms/blog/posts/public?categoryId=<id>&lang=<locale>` — FR-005.
- [ ] `/blog/tag/[slug].astro` (NEW) — filtro tag via `GET /api/v1/cms/blog/posts/public?tagSlugs=<slug>&lang=<locale>` — FR-009.
- [ ] `/blog/search.astro` (NEW) — island `BlogSearch.vue` que fetchea `GET /api/v1/cms/blog/posts/public?search=<q>&lang=<locale>` client-side — FR-010. `/blog/search` NO cacheado (routeRules `cache: false`).
- [ ] Sidebar con categorías (`GET /api/v1/cms/blog/categories/public?lang=<locale>`) y tags con counts (`GET /api/v1/cms/blog/tags/public?lang=<locale>`) — FR-011.
- [ ] JSON-LD: BlogPosting, BreadcrumbList en `/blog/[slug]` — FR-021.
- [ ] OG images por post — FR-023.

### Entregables — Pages CMS

- [ ] `/page/[slug].astro` — fetch `GET /api/v1/cms/pages/public/:slug?lang=<locale>` — FR-006.
- [ ] Generación de rutas por locale (`/page/[slug]` es, `/en/page/[slug]` en) — FR-017.
- [ ] SEO metadata via `GET /api/v1/cms/seo/:pageId?lang=<locale>` — FR-022.

### Entregables — ISR DIY (Astro 7 `Astro.cache` purge por tag)

- [ ] Endpoint `src/pages/api/revalidate.ts` completo: recibe `{ event, payload, timestamp }` + header `X-Revalidate-Signature`, verifica HMAC-SHA256 + timestamp < 5 min, mapea evento→tags (FR-043), purga cache por tag via `Astro.cache.delete(tag)` — FR-040, FR-041, FR-043, FR-044.
- [ ] NestJS CMS dispara webhook en hooks de `posts.service.ts`, `pages.service.ts`, `categories.service.ts`, `tags.service.ts` (post publish/update/unpublish, page update, category update, tag update) con firma HMAC-SHA256 + timestamp — FR-042.
- [ ] Mapa evento→tags implementado (Q-017 RESUELTA, definición exacta en FR-043) — FR-043.
- [ ] Purge parcial: solo tags afectados, no full rebuild — FR-044.
- [ ] Test: editar post en CMS → solo tags `blog` + `sitemap` purgados en < 60s; próxima request a `/blog/foo` re-fetchea lazy; `/page/about` NO se re-fetch (tag `pages` no purgado) — NFR-041, FR-044.

### Entregables — Sitemap + RSS

- [ ] `@astrojs/sitemap` configurado en `astro.config.mjs` con tag `sitemap` para purge on-demand — FR-018, NFR-005.
- [ ] `src/pages/rss.xml.ts` con posts publicados — FR-019.
- [ ] **Grep check antes de eliminar**: ejecutar `rg '/api/v1/sitemap' apps/front/ apps/back/`. Si Nuxt los consume, documentar como follow-up (cleanup Nuxt out-of-scope) y NO eliminar hasta coordinar. Si no consume, proceder — R6.
- [ ] **Eliminar endpoints `/api/v1/sitemap/*` del backend** (decisión usuario) — FR-018.
- [ ] **Eliminar sitemap de Nuxt** si existe (decisión usuario) — FR-018.
- [ ] Verificar que nada en backend/Nuxt referencia los endpoints eliminados (grep) — R6.

### Entregables — Deploy

- [ ] Deploy a prod (DNS `midominio.com` apunta a Astro) — FR-051.
- [ ] Config Coolify: Astro SSR Docker, start command `node ./dist/server/entry.mjs`, puerto 4321, "Is it a static site?" unchecked — FR-051.
- [ ] Pipelines CI/CD separados para `apps/web/` y `apps/front/` — FR-051.

### Criterios de salida

- `/blog/**`, `/page/**`, `/` servidos desde Astro en prod — FR-005, FR-006.
- `/blog/tag/[slug]` retorna posts con ese tag — FR-009.
- `/blog/search?q=foo` retorna posts que matchean `foo` (client-side, no cacheado) — FR-010.
- Sitemap `https://midominio.com/sitemap-index.xml` accesible y válido — NFR-005.
- `https://midominio.com/rss.xml` accesible y válido — FR-019.
- Backend ya no sirve `/api/v1/sitemap/*` (curl 404) — FR-018.
- Nuxt no genera sitemap — FR-018.
- ISR DIY: editar post en CMS → webhook purga tags `blog` + `sitemap` en < 60s; próxima request re-fetchea lazy; rutas con tag `pages`/`home` NO se re-fetchean — NFR-041, FR-044.
- URLs consistentes con Nuxt (NFR-004).
- Nuxt admin sigue sirviendo `/app/**` sin regresiones (smoke test).
- Lighthouse landing >= 95, JS < 10 KB — NFR-001, NFR-002.

### Riesgos

- Contenido stale si webhook ISR falla → retry con backoff + log + alerta (R3, R-ISR-1, R-ISR-2).
- Build acoplado backend → fallback graceful a estático (R3, NFR-007).
- SEO regression → mismas URLs + redirects 301 si cambia (R10, NFR-004).
- Webhook spoofing → HMAC-SHA256 + timestamp 5 min (R-ISR-1, NFR-040, Q-016 RESUELTA).
- Cache no persistencia en container restart → regeneración automática, aceptable (R-COOLIFY-1).
- Referencias residuales post-eliminación sitemap → grep check antes de eliminar (R6).

### Rollback

- Revertir DNS a Nuxt admin. Nuxt sigue sirviendo `/blog/**` y `/page/**` (aún no se han removido en este PRD — limpieza es out-of-scope). Sin pérdida de datos.
- Re-habilitar endpoints `/api/v1/sitemap/*` del backend (git revert).
- Extensión `web` queda (no afecta a nada, sin tablas DB).

---

## Timeline (estimación rough)

| Fase | Esfuerzo | Duración estimada |
|------|----------|-------------------|
| 0 | Setup infra + ISR endpoint skeleton + routeRules | 1-2 días |
| 1 | Landing + Contacto (Astro + ext web sin DB) + Q-020 inspección Maizzle | 3-5 días |
| 2 | Blog + Pages + ISR DIY (Astro.cache purge) + Sitemap | 4-6 días |

> Estimaciones rough. Ajustar tras Fase 0.