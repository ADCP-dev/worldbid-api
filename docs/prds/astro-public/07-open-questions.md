---
doc: astro-public/07-open-questions
title: "Open Questions"
status: draft
created: 2026-08-20
---

# Open Questions

Las open questions del draft anterior fueron revisadas. Se mantienen las resueltas válidas, se descartan las fuera de scope, se reabre Q-009 (re-resuelta a ISR DIY), y se añaden Q-016 a Q-020. **Q-016 y Q-017 RESUELTAS en este PRD. Q-020 queda PENDIENTE no bloqueante.**

## Resueltas (heredadas del draft, válidas)

### ✅ Q-001: Hosting final para Astro — RESUELTA

**Decisión**: Coolify (self-hosted PaaS sobre VPS + Docker). No Cloudflare Pages, Vercel ni Netlify.

**Razón**: self-hosted, sin agentes externos, control total. Mismo VPS puede servir Astro SSR vía Coolify + Nginx reverse proxy.

**Implementación**: `02-architecture.md` refleja Coolify. Astro deploy = Coolify servicio Docker (Astro SSR, adapter `@astrojs/node`, start command `node ./dist/server/entry.mjs`, puerto 4321).

---

### ✅ Q-002: Dominio vs subdominio para admin — RESUELTA

**Decisión**: Subdominio `app.midominio.com` para admin. Astro en `midominio.com`, API en `api.midominio.com`.

**Razón**: separación total, cookies scoped, CORS claro, deploy independiente por subdominio.

**Implementación**: DNS config en Fase 2 (deploy a prod). `FRONTEND_DOMAINS` incluye `midominio.com,app.midominio.com`.

---

### ✅ Q-003: Blog por API vs content collections — RESUELTA

**Decisión**: Blog por API NestJS. CMS es fuente única de verdad para TODO el contenido (blog + pages). NO content collections, NO markdown en repo.

**Razón**: mantener una sola fuente de contenido. Admin Nuxt ya gestiona blog en CMS. Duplicar a markdown en repo genera drift y sync manual.

**Implementación**: `03-requirements.md` FR-007. Fase 2 solo fetchea API. El endpoint `/posts/public` retorna posts con `translations` ya adjunto (no hace falta call separado).

---

### ✅ Q-005: Estrategia i18n final — RESUELTA

**Decisión**: Modo B — build-time fetch al módulo `modules/translations/` de NestJS. NO estático puro (Modo A descartado).

**Razón**: strings UI y contenido traducido vienen del módulo `modules/translations/` (NOT extensión). Build acoplado a backend en build time aceptado.

**Implementación**: `03-requirements.md` FR-014, FR-015, FR-016. `?lang=` siempre (mecanismo primario) en toda llamada. `x-custom-lang` header solo como alternativo. Fallback a estático es/en si API cae (NFR-007).

---

### ✅ Q-006: Stack de islands — RESUELTA

**Decisión**: Vue 3 para islands Astro.

**Razón**: consistencia con Nuxt admin (mismo lenguaje, share de lógica pura posible).

**Implementación**: `@astrojs/vue` integration en `astro.config.mjs`. Islands: `ContactForm.vue`, `BlogSearch.vue`.

---

### ✅ Q-008: Endpoints CMS públicos en NestJS — HALLAZGO TÉCNICO VERIFICADO

**Tipo**: Hallazgo técnico (no decisión). Endpoints públicos confirmados vía inspección de source code en `apps/back/src/extensions/cms/`.

**Endpoints públicos confirmados** (rutas `/public` sin auth):

| Endpoint | Query params | Uso Astro build/render |
|----------|--------------|-----------------|
| `GET /api/v1/cms/blog/posts/public` | ?lang&search&tagSlugs&categoryId&page&limit | Listar posts (con búsqueda, filtro tag/categoría, paginación) |
| `GET /api/v1/cms/blog/posts/public/:slug` | ?lang | Detalle post (translated-slug aware, fallback base slug) |
| `GET /api/v1/cms/blog/posts/public/:slug/related` | ?limit=3 | Posts relacionados |
| `GET /api/v1/cms/blog/posts/public/category/:categoryId` | ?page&limit&lang | Posts por categoría |
| `GET /api/v1/cms/blog/categories/public` | ?lang | Árbol categorías |
| `GET /api/v1/cms/blog/categories/public/by-slug/:slug` | ?lang | Categoría por slug |
| `GET /api/v1/cms/blog/tags/public` | ?lang | Tags con counts |
| `GET /api/v1/cms/pages/public` | ?lang&page&limit | Listar páginas |
| `GET /api/v1/cms/pages/public/:slug` | ?lang | Detalle página por slug |
| `GET /api/v1/cms/seo/:entityName/:entityId` | ?lang | SEO metadata por entidad |
| `GET /api/v1/cms/seo/:pageId` | ?lang | SEO metadata por página |
| `GET /api/v1/cms/seo/template/:type` | — | Plantillas JSON-LD |
| `GET /api/v1/translations/langs` | — | Locales disponibles |
| `GET /api/v1/translations/exact-by-path` | ?app&dotPath | Strings UI |

**Nota clave**: `/posts/public` retorna posts con `translations: { [langCode]: { [key]: content } }` ya adjunto (join server-side). Astro hace UN call por lista/detalle, sin call separado de traducciones.

**Envelope paginación**: `{ data: [...], meta: { page, limit, total, totalPages } }`.

**Implementación**: `03-requirements.md` FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-022. `04-context.md` tabla de endpoints.

---

### ✅ Q-011: Auth pages — Nuxt o Astro — RESUELTA

**Decisión**: Auth pages (`/login`, `/register`, `/forgot-password`, `/password-change`, `/login-basic`) se quedan en Nuxt.

**Razón**: forms interactivos, auth client-side. Astro no maneja auth estática.

**Implementación**: N/A. No se migran.

---

### ✅ Q-014: Dark mode — RESUELTA

**Decisión**: NO dark mode. Sin variantes light/dark en tokens.

**Razón**: scope reducido, simplicidad. Web pública y admin quedan en modo único.

**Implementación**: `04-context.md` refleja constraint.

---

### ✅ Q-015: Owner del PRD — RESUELTA

**Decisión**: el usuario es owner del PRD y responsable de aprobar fases.

**Razón**: proyecto personal, una sola persona decide.

**Implementación**: N/A. El usuario aprueba cada fase antes de ejecutar.

---

## Reabierta y re-resuelta

### 🔄 Q-009: Mecanismo de revalidación — RE-RESUELTA (ISR DIY via Astro.cache)

**Decisión previa (draft)**: Deploy hook de Coolify (full rebuild).

**Nueva decisión**: ISR DIY con Astro 7 `Astro.cache` API + `routeRules` vía webhook desde CMS. Astro NO tiene ISR nativo como Next.js — la combinación de `routeRules` (declarativo: `maxAge` + `swr` + `tags` por patrón de ruta, STABLE en v7) + `Astro.cache` API (purge por tag desde endpoint server-side, STABLE en v7) hace viable ISR DIY sin middleware custom. Se purgan SOLO los tags mapeados al evento (post/category/tag/page/sitemap), NO full rebuild. Las rutas cacheadas re-fetchean lazy en la próxima request (SWR sirve stale meanwhile).

**Razón del cambio**: el full rebuild en cada edición es costoso (rebuild completo del sitio, minutos). ISR DIY purge por tag es granular (atómico, invalida todas las rutas con ese tag) y latencia < 60s. El PRD previo afirmaba "Astro 5 ISR on-demand nativo" — era falso (Astro no tiene ISR nativo). La estrategia correcta es DIY con las dos APIs STABLE en v7.

**Implementación**: `02-architecture.md` modelo ISR DIY (`Astro.cache` + `routeRules`). `03-requirements.md` FR-039, FR-040, FR-041, FR-043, FR-044. `06-migration-phases.md` Fase 2. Webhook endpoint `apps/web/src/pages/api/revalidate.ts`. CMS dispara webhook en hooks de services con firma HMAC + timestamp.

**Invalida**: la decisión previa del draft Q-009 (Coolify full-rebuild hook) queda descartada.

---

## Descartadas (fuera de scope de este PRD)

### ❌ Q-004: Migración auth a httpOnly cookie — DESCARTADA

**Razón**: fuera de scope. La migración de auth a httpOnly cookies no se incluye en este PRD. El draft la marcaba como "recomendada no bloqueante"; este PRD la elimina del alcance.

---

### ❌ Q-007: Versionado de `packages/ui` — DESCARTADA

**Razón**: `packages/ui` fuera de scope. Cada app maneja sus propios tokens. No se crea package compartido.

---

### ❌ Q-010: Nuxt admin post-cleanup: SSR o SPA puro — DESCARTADA

**Razón**: la limpieza de Nuxt es out-of-scope. Nuxt admin no se modifica en este PRD.

---

### ❌ Q-012: Ecommerce + Stripe existente — DESCARTADA

**Razón**: ecommerce fuera de scope. No se incluye en este PRD.

---

### ❌ Q-013: Filtros y búsqueda ecommerce — DESCARTADA

**Razón**: ecommerce fuera de scope.

---

## Nuevas (Q-016 a Q-020)

### ✅ Q-016: ISR webhook security — HMAC-SHA256 + timestamp + 5 min window — RESUELTA

**Pregunta**: ¿cómo se asegura el webhook ISR? ¿HMAC-SHA256 con timestamp + window de validez para prevenir replay attacks?

**Decisión**: **HMAC-SHA256 + timestamp (ISO 8601) + window 5 min**.

- Secret en `REVALIDATE_SECRET` env var (estático, compartido entre NestJS y Astro). NO JWT (overkill para este caso).
- Webhook payload incluye `timestamp` (ISO 8601); Astro endpoint rechaza si timestamp older than 5 min (previene replay attacks).
- Secret solo rota si se compromete (controlado por el usuario, NO rotación automática). Rotación = update simultáneo en NestJS + Astro env vars + redeploy.

**Impacto**: resuelto — NFR-040 especifica este mecanismo exacto. FR-041 implementa la verificación. FR-042 firma el webhook desde NestJS.

**Implementación**: `03-requirements.md` FR-041 (verificación), FR-042 (firma), NFR-040 (mecanismo). Código de verificación:

```typescript
// apps/web/src/lib/revalidate-hmac.ts
import crypto from 'node:crypto';

export function verifyWebhookSignature(
  signature: string | null,
  body: unknown,
  secret: string,
  maxAgeMs = 5 * 60 * 1000, // 5 min
): boolean {
  if (!signature) return false;
  const bodyStr = JSON.stringify(body);
  const expected = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  // Check timestamp window
  const { timestamp } = body as { timestamp: string };
  const age = Date.now() - new Date(timestamp).getTime();
  if (age > maxAgeMs || age < -maxAgeMs) return false;
  return true;
}
```

---

### ✅ Q-017: CMS event → route revalidation map — RESUELTA

**Pregunta**: ¿cuál es el mapa EXACTO de eventos CMS → rutas a revalidar?

**Decisión**: confirmar el mapa (en términos de **tags a purgar** vía `Astro.cache.delete(tag)`, no rutas individuales — el purge por tag invalida todas las rutas cacheadas con ese tag, lazy re-fetch en próxima request):

| Evento CMS | Tags purgados | Rutas afectadas (lazy re-fetch) |
|------------|---------------|---------------------------------|
| `post.published` / `post.updated` / `post.unpublished` | `blog`, `sitemap` | `/blog/[slug]`, `/blog`, `/blog/c/[categoryId]`, `/blog/category/[categorySlug]`, `/blog/tag/[tagSlug]` (por cada tag del post), `/sitemap-index.xml`, `/sitemap-0.xml` |
| `page.updated` | `pages`, `sitemap` (+ `home` si PageSection='landing') | `/page/[slug]`, `/` (si landing), sitemaps |
| `category.updated` | `blog`, `sitemap` | `/blog/c/[slug]`, `/blog/category/[slug]`, `/blog`, sitemaps |
| `tag.updated` | `blog`, `sitemap` | `/blog/tag/[slug]`, `/blog`, sitemaps |

> `/blog/search` NO se revalida — es client-side island, fetchea en runtime, sin cache server-side.

**Impacto**: resuelto — FR-043 especifica el mapa exacto. Define la lógica del endpoint `/api/revalidate`.

**Implementación**: `03-requirements.md` FR-043. El endpoint mapea `event` → array de tags y llama `Astro.cache.delete(tag)` por cada uno.

---

### ❓ Q-018: Contact spam protection — honeypot solo o + captcha — PENDIENTE (no bloqueante)

**Pregunta**: más allá del rate limit (`@Throttle(5, 60_000)`), ¿se añade captcha al formulario de contacto?

**Opciones**:
- (a) Honeypot field oculto solo (NFR-042 ya lo requiere). Simple, sin dependencias.
- (b) Honeypot + hCaptcha (gratis, privacy-friendly).
- (c) Honeypot + reCAPTCHA (Google, más invasivo).

**Impacto**: no bloqueante para Fase 1 (honeypot es mínimo). Si se añade captcha, requiere integration con provider.

**Recomendación**: (a) honeypot solo en Fase 1. Si spam persiste tras deploy, añadir (b) hCaptcha en iteración.

---

### ✅ Q-019: Newsletter — deferred to future phase — RESUELTA (deferred)

**Pregunta**: ¿cuándo se implementa newsletter?

**Decisión**: newsletter se documenta como FASE FUTURA en la extensión `web`, pero NO se implementa ahora.

**Razón**: scope reducido. El contacto es la prioridad. Newsletter reutiliza la misma extensión `web` (futura tabla `ext_web_newsletter_subscription`, endpoint `POST /api/v1/newsletter/subscribe`, MailService method).

**Impacto**: ninguno para este PRD. Se documenta para que la extensión `web` esté diseñada para extensión futura.

**Recomendación**: documentar en `docs/extensions/web.md` (cuando se cree) como "Future: newsletter subscription".

---

### ❓ Q-020: Maizzle template location + rendering pipeline — PENDIENTE (no bloqueante)

**Pregunta**: ¿dónde se ubica la plantilla `contact-notification.hbs` y cómo se renderiza?

**Opciones**:
- (a) En el directorio Maizzle existente del backend (verificar `apps/back/` estructura Maizzle). Renderizado via `MailService` que ya usa Maizzle.
- (b) Template inline en `MailService` con handlebars string.

**Impacto**: NO bloqueante. Fase 0 no toca el backend. La inspección del directorio Maizzle se hace al inicio de Fase 1 (investigación de 5 min). Seguir el patrón existente de MailService — la ubicación exacta se confirma inspeccionando el directorio Maizzle en Fase 1.

**Recomendación**: (a) seguir el patrón existente del backend. Inspeccionar `MailService` y el directorio de templates Maizzle al inicio de Fase 1 para confirmar ubicación (5 min).

---

## Resumen

| ID | Tema | Estado |
|----|------|--------|
| Q-001 | Hosting Astro | ✅ Coolify (Astro SSR Docker) |
| Q-002 | Dominio/subdominio | ✅ Subdominios |
| Q-003 | Blog: API vs collections | ✅ API NestJS |
| Q-004 | Auth httpOnly cookie | ❌ Descartada (out of scope) |
| Q-005 | i18n Modo A vs B | ✅ Modo B (build-time fetch + ?lang=) |
| Q-006 | Stack islands | ✅ Vue 3 |
| Q-007 | Versionado `packages/ui` | ❌ Descartada (out of scope) |
| Q-008 | Endpoints CMS públicos | ✅ Hallazgo técnico verificado |
| Q-009 | Webhook rebuild | 🔄 Re-resuelta: ISR DIY via Astro.cache + routeRules (no full rebuild) |
| Q-010 | Nuxt SSR vs SPA | ❌ Descartada (out of scope) |
| Q-011 | Auth pages ubicación | ✅ Nuxt |
| Q-012 | Ecommerce + Stripe | ❌ Descartada (out of scope) |
| Q-013 | Filtros ecommerce | ❌ Descartada (out of scope) |
| Q-014 | Dark mode | ✅ Sin dark mode |
| Q-015 | Owner PRD | ✅ Usuario |
| Q-016 | ISR webhook security | ✅ RESUELTA: HMAC-SHA256 + timestamp + 5 min window |
| Q-017 | CMS event → route map | ✅ RESUELTA: mapa confirmado (tags a purgar) |
| Q-018 | Contact spam protection | ❓ Pendiente (honeypot solo recomendado en Fase 1, no bloqueante) |
| Q-019 | Newsletter | ✅ Deferred a fase futura |
| Q-020 | Maizzle template pipeline | ❓ Pendiente (no bloqueante, se resuelve al inicio de Fase 1, inspección 5 min) |

> No se añade Q-021 — el gap "falta Q-021" del análisis anterior no aplica: como contacto es sin persistencia (FR-031), no hay decisión de persistencia que catalogar.