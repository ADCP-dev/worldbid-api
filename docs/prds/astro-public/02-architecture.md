---
doc: astro-public/02-architecture
title: "Arquitectura"
status: draft
created: 2026-08-20
---

# Arquitectura

## Diagrama target

```
                      ┌──────────────────────────┐
                      │      NestJS API          │
                      │      apps/back/          │
                      │  PostgreSQL + TypeORM    │
                      │  Bull queues + Nodemailer │
                      │  Extensions:             │
                      │    cms, crm, affiliate,   │
                      │    content-pipeline,      │
                      │    autonomous-agent,      │
                      │    stripe, upload-post,   │
                      │    web (NEW)              │
                      └─────────────┬────────────┘
                                    │ REST /api/v1
                                    │ + webhook ISR
                      ┌─────────────┴────────────┐
                      │                          │
          ┌───────────▼──────────┐   ┌───────────▼──────────┐
          │   Nuxt admin         │   │   Astro web          │
          │   apps/front/        │   │   apps/web/          │
          │                      │   │                      │
          │   Backoffice puro    │   │   Web pública        │
          │   /app/**            │   │   / /blog /page      │
          │   Node server        │   │   SSR Node server     │
          │   Auth client-side   │   │   output: 'server'   │
          │   TanStack Query     │   │   @astrojs/node      │
          │   Tiptap/Kanban/Cal  │   │   routeRules + cache │
          │                      │   │   0 JS por defecto   │
          │                      │   │   Islands Vue        │
          │                      │   │   Blog vía API        │
          │                      │   │   Contacto → ext web  │
          │                      │   │   /api/revalidate    │
          └──────────────────────┘   └──────────┬───────────┘
                                                │
                                     ┌──────────▼───────────┐
                                     │  Coolify (Docker)    │
                                     │  node ./dist/server/ │
                                     │  entry.mjs :4321     │
                                     │  Nginx reverse proxy │
                                     └──────────────────────┘
```

> Deploy via Coolify (self-hosted PaaS, Docker + Nginx reverse proxy). Astro 7 en modo `output: 'server'` con adapter `@astrojs/node` corriendo como proceso Node en el container. ISR DIY via `Astro.cache` + `routeRules` (no ISR nativo).

## Estructura del monorepo

| Path | Rol | Stack |
|------|-----|-------|
| `apps/back/` | API, corazón del negocio | NestJS + TypeORM + PostgreSQL |
| `apps/front/` | Backoffice admin (sin cambios) | Nuxt 3 + Vue 3 + Pinia + TanStack |
| `apps/web/` | Web pública (NEW) | Astro 7 + Tailwind 4 + DaisyUI 5 |

> Sin `packages/ui/` (fuera de scope — cada app maneja sus propios tokens).

## Responsabilidades por app

### `apps/back/` (NestJS)

- API REST `/api/v1/**`.
- Auth (JWT, refresh, roles, RBAC). Endpoints públicos sin guard; admin con `@AdminAuth()`.
- CMS extension: blog posts, pages, categories, tags, SEO, media. Endpoints públicos bajo `/public`.
- Módulo `translations` (NOT extensión): strings UI + contenido CMS traducido (polimórfico).
- Extensiones existentes: cms, crm, affiliate, content-pipeline, autonomous-agent, stripe, upload-post.
- **NUEVA extensión `web`**: endpoint de contacto `POST /api/v1/contact` + `MailService.contactFormNotification()` + Maizzle template + `@Throttle(5, 60_000)`. **SIN tablas DB** (los mensajes de contacto NO se persisten — solo se envían por email, ver FR-031). La extensión sigue siendo auto-discovered via `extension.module.ts`.
- CORS via `FRONTEND_DOMAINS` env var (CSV) — append dominio Astro, sin code change.
- **Sitemap removido**: se eliminan endpoints `/api/v1/sitemap/*` (decisión usuario — centralizar en Astro).
- **Webhook ISR**: el CMS dispara `POST <ASTRO_URL>/api/revalidate` con payload `{ event, payload, timestamp }` + firma HMAC-SHA256 (header `X-Revalidate-Signature`) al publicar/editar/despublicar posts/pages/categorías/tags (FR-042).

### `apps/front/` (Nuxt admin)

- Backoffice interactivo `/app/**`.
- Dashboard, users, settings, cms admin, crm, affiliate, content-pipeline, autonomous-agent, stripe, upload-post.
- Auth client-side (Pinia + `localStorage` + JWT + refresh).
- TanStack Query para cache.
- **Sin cambios arquitecturales** en este PRD. La limpieza de landing/blog/page es out-of-scope.
- **Sitemap removido**: se elimina cualquier generación de sitemap en Nuxt (decisión usuario).

### `apps/web/` (Astro 7 — NEW)

- Landing `/` (incluye formulario de contacto — PageSection 'landing' del CMS).
- Blog `/blog/**` (vía API NestJS): index, detalle, categoría, tag, búsqueda.
- Páginas CMS `/page/**` (vía API NestJS).
- SEO: sitemap (`@astrojs/sitemap`), RSS (`@astrojs/rss`), JSON-LD, OG images.
- i18n es/en consumiendo `/api/v1/translations/*` con `?lang=` siempre.
- **0 JS por defecto**, islands Vue 3 explícitos donde interactividad necesaria (form contacto, búsqueda blog).
- **ISR DIY (Astro 7 `Astro.cache` + `routeRules`)**: `output: 'server'` + adapter `@astrojs/node`. `routeRules` declara cache por patrón de ruta con `maxAge` + `swr` + `tags`. El cache vive en memoria del proceso Node. El endpoint `POST /api/revalidate` recibe el webhook del CMS, verifica HMAC-SHA256 + timestamp, y purga el cache por tag via `Astro.cache` API. Las rutas cacheadas re-fetchean lazy en la próxima request (SWR sirve stale mientras tanto).
- Auth pages (`/login`, `/register`, etc.) **se quedan en Nuxt** (forms interactivos, auth client-side). Astro no maneja auth.

## Modelo de render: ISR DIY con Astro 7 `Astro.cache` + `routeRules`

Astro NO tiene ISR nativo como Next.js. La estrategia es ISR DIY usando dos APIs STABLE en Astro 7 (eran experimentales en v6):

1. **`routeRules`** (declarativa, en `astro.config.mjs`): define cache por patrón de ruta con `maxAge` (segundos), `swr` (stale-while-revalidate, segundos) y `tags` (array de strings para agrupar rutas a invalidar).
2. **`Astro.cache` API** (programática): purga cache por tag desde un endpoint server-side.

El cache vive en **memoria del proceso Node** (Coolify container). Si el container restartea, el cache se regenera en la próxima request (cold start). Para un proyecto de 1 container Coolify esto es aceptable — ver R-COOLIFY-1.

### `astro.config.mjs` (extracto)

```javascript
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  routeRules: {
    '/':             { cache: { maxAge: 3600, swr: 60,  tags: ['home'] } },
    '/blog':         { cache: { maxAge: 300,  swr: 60,  tags: ['blog', 'blog-index'] } },
    '/blog/**':      { cache: { maxAge: 300,  swr: 60,  tags: ['blog'] } },
    '/page/**':      { cache: { maxAge: 600,  swr: 60,  tags: ['pages'] } },
    '/blog/search':  { cache: false }, // island client-side, fetches runtime
  },
  integrations: [/* tailwind, vue, sitemap, rss, astro-seo */],
});
```

### Flujo ISR DIY

```mermaid
sequenceDiagram
    participant Admin as Admin (Nuxt)
    participant CMS as NestJS CMS
    participant Webhook as Astro /api/revalidate
    participant Cache as Astro.cache (Node memory)
    visitor as Visitante

    Admin->>CMS: PATCH /cms/blog/posts/:id (publish/edit)
    CMS->>CMS: Build webhook payload { event, payload, timestamp }
    CMS->>CMS: Sign with HMAC-SHA256(REVALIDATE_SECRET)
    CMS->>Webhook: POST /api/revalidate + X-Revalidate-Signature
    Webhook->>Webhook: Verify HMAC signature + timestamp < 5min
    Webhook->>Webhook: Map event → tags to purge (FR-043)
    Webhook->>Cache: Astro.cache.delete('blog')  // purge by tag
    Cache-->>Webhook: 200 OK (purge atómico por tag)
    Note over Cache: Rutas cacheadas con tag 'blog' marcadas stale
    visitor->>Cache: GET /blog/foo (next request)
    Cache->>CMS: Re-fetch (lazy, SWR sirve stale meanwhile)
    Cache->>visitor: Fresh HTML
    Note over Cache: Otras rutas (pages, home) NO re-fetchean
```

> El webhook purga cache por **tag** (atómicamente), NO "revalida rutas individualmente". El purge de un tag invalida todas las rutas cacheadas con ese tag. Las rutas re-fetchean lazy en la próxima request (SWR sirve el HTML stale mientras tanto). `/blog/search` NO se cachea (island client-side, fetchea en runtime, no se revalida).

### Mapa evento CMS → tags a purgar (FR-043 / Q-017 RESUELTA)

| Evento CMS | Tags purgados (Astro.cache.delete) | Rutas afectadas (lazy re-fetch) |
|------------|-----------------------------------|---------------------------------|
| `post.published` / `post.updated` / `post.unpublished` | `blog` | `/blog/[slug]`, `/blog`, `/blog/c/[categoryId]`, `/blog/category/[categorySlug]`, `/blog/tag/[tagSlug]` (por cada tag del post) |
| `page.updated` | `pages` (+ `home` si PageSection='landing') | `/page/[slug]`, `/` (si landing) |
| `category.updated` | `blog` | `/blog/c/[slug]`, `/blog/category/[slug]`, `/blog` |
| `tag.updated` | `blog` | `/blog/tag/[slug]`, `/blog` |
| (cualquiera de arriba) | `sitemap` (custom tag para rutas de sitemap) | `/sitemap-index.xml`, `/sitemap-0.xml` |

> `/blog/search` NO se revalida — es un island client-side que fetchea `GET /api/v1/cms/blog/posts/public?search=...` en runtime, sin cache server-side.

## Flujo de datos: contacto (sin persistencia)

```mermaid
flowchart LR
    A[Usuario en landing] -->|fill form| B[ContactForm island Vue]
    B -->|POST /api/v1/contact| C[NestJS ext web]
    C -->|@Throttle 5/60s| D{Rate limit}
    D -->|< 5 en 60s| E{Honeypot filled?}
    D -->|>= 5 en 60s| F[429 Too Many Requests]
    E -->|no| G[Validate DTO]
    E -->|yes, bot| H[201 false silent<br/>descarta, NO envía email]
    G -->|invalid| I[400 Bad Request]
    G -->|valid| J[MailService.contactFormNotification]
    J -->|render Maizzle + Nodemailer SMTP| K{Send OK?}
    K -->|yes| L[201 Created]
    K -->|no, send failure| M[500 Internal Server Error]
    J -->|email to app.notificationEmail| N[Admin inbox]
    L --> B
    B -->|success toast| A
    M --> B
    B -->|error toast| A
```

> **Sin persistencia**: los mensajes de contacto NO se guardan en DB. No hay tabla `ext_web_contact_message`, no hay migración. El endpoint valida DTO → envía email via MailService → responde 201. Cero GDPR/retention concerns porque nada se almacena.

**DTO contacto**: `{ name: string, email: string, message: string, lang?: string }`

**Config reutilizada**: `app.notificationEmail` (ya existe en `app-config.type.ts`).

**Flujos distintos (R-CONTACT-2 clarificación)**: honeypot relleno = 201 false silent (bot descartado, NO se envía email, no hay conflicto con NFR-042). Falla real de envío (SMTP caído, template render error) = 500 (error legítimo, usuario ve toast de error). Dos paths distintos, ninguna contradicción.

## Flujo de datos: blog (categoría / tags / búsqueda)

```mermaid
flowchart LR
    A[Usuario /blog] --> B[Astro page server]
    B -->|GET /api/v1/cms/blog/posts/public?lang=es&page=1| C[NestJS CMS ext]
    C -->|{ data, meta }| B
    B --> D[HTML cacheado por tag 'blog']

    E[Usuario /blog/tag/[slug]] --> F[Astro page server]
    F -->|GET /api/v1/cms/blog/posts/public?tagSlugs=slug&lang=es| C
    C -->|{ data, meta }| F

    G[Usuario /blog/search?q=foo] --> H[Astro page + BlogSearch.vue island]
    H -->|client-side GET /api/v1/cms/blog/posts/public?search=foo&lang=es| C
    C -->|{ data, meta }| H
```

> `/posts/public` acepta `?search&tagSlugs&categoryId&lang&page&limit` (verificado). Un solo call por vista. `/blog/search` es client-side (island), NO cacheado server-side.

## Estructura interna `apps/web/`

```
apps/web/
├── astro.config.mjs                      # output:'server' + @astrojs/node + routeRules
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── public/{favicon.ico,og/,fonts/}
└── src/
    ├── pages/
    │   ├── index.astro                      # landing /
    │   ├── blog/
    │   │   ├── index.astro                  # /blog
    │   │   ├── [slug].astro                 # /blog/[slug]
    │   │   ├── c/[slug].astro               # /blog/c/[slug] (categoría corta)
    │   │   ├── category/[slug].astro        # /blog/category/[slug]
    │   │   ├── tag/[slug].astro             # /blog/tag/[slug] (NEW)
    │   │   └── search.astro                 # /blog/search (NEW, island, NO cacheado)
    │   ├── page/[slug].astro                # CMS pages
    │   ├── api/
    │   │   └── revalidate.ts                # ISR webhook endpoint (NEW, purge by tag)
    │   ├── rss.xml.ts                       # RSS feed
    │   └── {404,500}.astro
    ├── layouts/{BaseLayout,PublicLayout,BlogLayout}.astro
    ├── components/
    │   ├── landing/                         # reescritos desde modules/landing/
    │   ├── blog/{PostCard,PostList,TagFilter,SearchBar}.astro
    │   ├── ui/                              # primitivos propios
    │   └── islands/
    │       ├── ContactForm.vue              # formulario contacto
    │       └── BlogSearch.vue               # búsqueda blog (island)
    ├── i18n/{ui.ts,es.json,en.json,locales.json}
    ├── lib/{api.ts,seo.ts,revalidate-hmac.ts}
    ├── styles/global.css
    └── env.d.ts
```

> Sin `src/content/` (blog vía API, no content collections).

### Endpoint `/api/revalidate.ts` (skeleton)

```typescript
import type { APIRoute } from 'astro';
import { verifyWebhookSignature } from '~/lib/revalidate-hmac';

export const POST: APIRoute = async ({ request, Astro }) => {
  const signature = request.headers.get('X-Revalidate-Signature');
  const body = await request.json();
  const { event, payload, timestamp } = body;

  // 1. Verify HMAC + timestamp window (5 min)
  const valid = verifyWebhookSignature(signature, body, import.meta.env.REVALIDATE_SECRET);
  if (!valid) return new Response('Unauthorized', { status: 401 });

  // 2. Map event → tags to purge (FR-043)
  const tags = mapEventToTags(event, payload);

  // 3. Purge cache by tag via Astro.cache (Astro 7 stable API)
  for (const tag of tags) {
    await Astro.cache.delete(tag);
  }

  return new Response(JSON.stringify({ purged: tags }), { status: 200 });
};
```

## Diferencias con estado actual

| Aspecto | Estado actual | Target |
|---------|---------------|--------|
| Web pública | Nuxt SSG híbrido + Node server | Astro 7 SSR + ISR DIY (`Astro.cache` + `routeRules`) |
| Build | Dual `.output/public` + `.output/server` | Astro `dist/server/entry.mjs` (proceso Node) |
| Runtime landing | Node server para rutas `prerender:false` | Proceso Node (Coolify Docker, `node ./dist/server/entry.mjs`) |
| Cache | Nuxt SWR client-side + Coolify full-rebuild hook | Astro 7 `routeRules` (memoria proceso Node) + purge por tag |
| i18n | Hook runtime fetchea backend en startup | Build-time fetch + `?lang=` siempre |
| JS payload landing | Arrastra auth store, TanStack, i18n hook | 0 KB por defecto |
| Sitemap | Backend `/api/v1/sitemap/*` + Nuxt | Astro `@astrojs/sitemap` (único) |
| Contacto | No existe | Nueva extensión `web` (sin DB) + endpoint + email |
| Revalidación | Coolify full-rebuild hook | Astro 7 `Astro.cache` purge por tag (webhook HMAC) |

## Decisiones con trade-offs

### D-01: Astro 7 + Vue islands para web pública

**Decisión**: web pública migra a Astro 7 con islands en Vue 3.

**Razones**: contenido estático óptimo (CDN, 0 JS por defecto, SEO), performance superior a Nuxt SSG híbrido para contenido, equipo ya conoce Vue (consistencia mental con admin), Astro 7 estabiliza `Astro.cache` + `routeRules` (lo que permite ISR DIY sin middleware custom).

**Alternativas descartadas**:
- *Mantener Nuxt SSG para todo*: arrastra Node server runtime y payload de auth/i18n en landing.
- *Astro + React islands*: stack distinto al admin.
- *Astro + Preact*: más liviano pero contexto distinto, pérdida de consistencia.

**Trade-off**: doble codebase frontend (Astro + Nuxt). Se sacrifica simplicidad de un solo repo SPA; se gana aislamiento de fallos, performance y tools óptimas por naturaleza.

### D-02: ISR DIY con Astro 7 `Astro.cache` + `routeRules` (no ISR nativo, no full rebuild)

**Decisión**: ISR DIY via Astro 7 `routeRules` (declarativo: `maxAge` + `swr` + `tags`) + `Astro.cache` API (purge por tag desde endpoint `/api/revalidate`). Astro NO tiene ISR nativo como Next.js — la combinación de estas dos APIs STABLE en v7 hace viable ISR DIY sin middleware custom.

**Razones**: un full rebuild en cada edición de post es costoso (rebuild completo del sitio, minutos). ISR DIY purga por tag (atómico, todas las rutas cacheadas con ese tag se invalidan) y las rutas re-fetchean lazy en la próxima request (SWR sirve stale meanwhile). Latencia objetivo < 60s. El cache vive en memoria del proceso Node (Coolify container) — sin Redis, sin infra extra.

**Alternativas descartadas**:
- *Coolify full-rebuild hook* (draft Q-009): rebuild completo, lento, acopla deploy a CMS. Descartado.
- *ISR nativo como Next.js*: NO existe en Astro. El PRD previo afirmaba "Astro 5 ISR on-demand nativo" — era falso.
- *SWR con TTL corto (60s) sin purge*: pérdida de performance, contenido stale hasta 60s, no reacciona a ediciones del CMS.
- *Cache distribuido Redis*: overkill para 1 container Coolify.

**Trade-off**: complejidad de implementar webhook + mapa evento→tag + seguridad HMAC. Cache no persiste si container restartea (R-COOLIFY-1, baja severidad, regenera en próxima request). Se sacrifica durabilidad del cache; se gana simplicidad operativa (sin Redis) y latencia baja.

### D-03: Nueva extensión `web` para contacto (sin DB)

**Decisión**: contacto se implementa como nueva extensión backend `web` (auto-discovered via `extension.module.ts`), generada con `pnpm generate:extension -- --name=web`. **SIN tablas DB** — los mensajes no se persisten, solo se envían por email. La extensión existe para consistencia con el patrón del monorepo y permitir futura newsletter en la misma extensión.

**Razones**: consistencia con el patrón de extensiones del monorepo. Auto-discovery via `extension.module.ts` (sin tocar `app.module.ts`). Permite futura newsletter en la misma extensión (Q-019, fase futura). Sin persistencia = sin GDPR/retention concerns, sin migración, sin tabla `ext_web_*`.

**Alternativas descartadas**:
- *Endpoint en módulo core*: rompe el patrón extension, requiere editar `app.module.ts`.
- *Endpoint en extensión `cms`*: mezcla responsabilidades (CMS es contenido, web es interacción pública).
- *Persistir mensajes en `ext_web_contact_message`*: descartado por el usuario. Sin persistencia = más simple.

**Trade-off**: sin persistencia, no hay historial de mensajes enviados. Si se necesita auditoría futura, se añade tabla + migración en una iteración posterior (la extensión `web` está diseñada para extensión futura — Q-019). Se sacrifica auditabilidad; se gana simplicidad y cero GDPR overhead.

### D-04: Sitemap centralizado en Astro

**Decisión**: Astro genera sitemap con `@astrojs/sitemap`. Se eliminan los endpoints `/api/v1/sitemap/*` del backend y cualquier sitemap en Nuxt.

**Razones**: reduce duplicación (sitemaps en backend + Nuxt + Astro = 3 fuentes). Astro es la app que conoce todas las rutas públicas. Una sola fuente de verdad.

**Alternativas descartadas**:
- *Mantener sitemap en backend*: requiere que Astro conozca rutas que el backend no sabe que existen.
- *Mantener sitemap en Nuxt*: Nuxt ya no sirve la web pública.

**Trade-off**: al editar un post, el sitemap se re-purgea via tag `sitemap` (incluido en el mapa evento→tag). Se sacrifica un endpoint existente; se gana simplicidad operativa.

## Principios arquitecturales

1. **Contenido vs app**: tools distintas para naturalezas distintas.
2. **Static-first**: Astro sirve HTML, islas solo donde hace falta.
3. **ISR DIY**: `routeRules` cachea, `Astro.cache` purga por tag. No full rebuild.
4. **Aislamiento de fallos**: bug en admin no tira landing, pico en landing no carga admin.
5. **Sin big-bang**: migración incremental por fases (ver `06-migration-phases.md`).
6. **Extensiones auto-discovered**: nueva extensión `web` no toca `app.module.ts`.