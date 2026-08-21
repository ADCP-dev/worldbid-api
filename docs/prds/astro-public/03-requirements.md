---
doc: astro-public/03-requirements
title: "Requisitos (FR-NNN EARS + NFR-NNN)"
status: draft
created: 2026-08-20
---

# Requisitos (FR-NNN EARS + NFR-NNN)

Notación EARS. Cada FR referenciado por número en fases (`06-migration-phases.md`) y DoD (`08-definition-of-done.md`).

## Requisitos funcionales (FR-NNN)

### Landing y estructura web

**FR-001: Landing SSR con cache ISR DIY**
THE SYSTEM SHALL serve the landing page (`/`) as SSR HTML via Astro 7 `output: 'server'` with zero client-side JavaScript by default, with cache control via `routeRules` (tag `home`) and purge on-demand via `Astro.cache` triggered by the webhook endpoint `/api/revalidate`.

**FR-002: Componentes landing reescritos**
WHEN la Fase 1 finalice, THE SYSTEM SHALL servir los componentes actuales de `modules/landing/` reescritos como componentes `.astro` en `apps/web/src/components/landing/`.

**FR-003: Layout público**
THE SYSTEM SHALL render landing, blog y pages CMS dentro de un `PublicLayout.astro` compartido (navbar + footer) consistente con el design system de la app.

**FR-004: Landing incluye formulario de contacto**
THE SYSTEM SHALL render el formulario de contacto dentro de la landing (`/`) usando un island `ContactForm.vue`, que envía `POST /api/v1/contact` a la extensión `web` del backend (PageSection 'landing' del CMS cubre esta sección).

### Blog y content

**FR-005: Rutas blog**
THE SYSTEM SHALL exponer las rutas `/blog`, `/blog/[slug]`, `/blog/c/[slug]` (categoría corta), `/blog/category/[slug]`, `/blog/tag/[slug]` (filtro por tag) y `/blog/search` (búsqueda full-text), todas con SSR HTML cacheado via `routeRules` (tag `blog`) salvo `/blog/search` que NO se cachea (island Vue client-side, fetchea en runtime).

**FR-006: Páginas CMS dinámicas**
WHEN NestJS contenga una página publicada con slug `X`, THE SYSTEM SHALL generar la ruta `/page/[X]` en Astro fetcheando `GET /api/v1/cms/pages/public?lang=<locale>` en build/render time, cacheada via `routeRules` (tag `pages`).

**FR-007: Blog vía API NestJS en build/render time**
THE SYSTEM SHALL obtener el contenido del blog editorial fetcheando `GET /api/v1/cms/blog/posts/public?lang=<locale>&search=<q>&tagSlugs=<slugs>&categoryId=<id>&page=<n>&limit=<n>` en build/render time. CMS (NestJS) es fuente única de verdad para TODO el contenido (blog + pages). NO content collections, NO markdown en repo. El endpoint `/posts/public` retorna los posts con el campo `translations: { [langCode]: { [key]: content } }` ya adjunto (join server-side vía `loadTranslationsForPosts()` + `attachTranslations()`), por lo que Astro NO necesita un call separado de traducciones por post.

**FR-008: Posts relacionados**
WHEN un usuario visite `/blog/[slug]`, THE SYSTEM SHALL mostrar posts relacionados fetcheando `GET /api/v1/cms/blog/posts/public/:slug/related?limit=3` en build/render time.

**FR-009: Filtro por tag**
WHEN un usuario visite `/blog/tag/[slug]`, THE SYSTEM SHALL mostrar los posts con ese tag fetcheando `GET /api/v1/cms/blog/posts/public?tagSlugs=<slug>&lang=<locale>` en build/render time.

**FR-010: Búsqueda full-text**
THE SYSTEM SHALL proveer un island `BlogSearch.vue` en `/blog/search` que al escribir fetchee `GET /api/v1/cms/blog/posts/public?search=<q>&lang=<locale>&page=<n>&limit=<n>` client-side y muestre resultados paginados. `/blog/search` NO se cachea server-side (fetches runtime, no se revalida vía webhook).

**FR-011: Categorías y tags con counts**
THE SYSTEM SHALL obtener el árbol de categorías via `GET /api/v1/cms/blog/categories/public?lang=<locale>` y los tags con counts via `GET /api/v1/cms/blog/tags/public?lang=<locale>` en build/render time, renderizando ambos en el sidebar/filtro del blog.

**FR-012: Consumo de paginación**
THE SYSTEM SHALL consumir el envelope de paginación `{ data: [...], meta: { page, limit, total, totalPages } }` retornado por los endpoints `/public` y renderizar paginación con `meta.totalPages`.

### Páginas error

**FR-013: Páginas error estáticas**
WHEN el usuario solicite una ruta inexistente o el servidor falle, THE SYSTEM SHALL servir `/404.astro` o `/500.astro` como HTML desde Astro.

### i18n — `?lang=` siempre (mecanismo primario)

**FR-014: i18n es/en por defecto**
THE SYSTEM SHALL servir el sitio en `es` (default, sin prefijo) y `en` (con prefijo `/en/...`) usando estrategia `prefix_except_default` consistente con el Nuxt actual. Locales adicionales desde DB vía `GET /api/v1/translations/langs` en build time.

**FR-015: Strings UI desde módulo translations**
THE SYSTEM SHALL cargar strings UI (nav, footer, botones, labels) fetcheando `GET /api/v1/translations/exact-by-path?app=front&dotPath=<path>` en build time desde el módulo `modules/translations/` (NOT extensión), con fallback a JSON estático es/en en `apps/web/src/i18n/` si la API cae (NFR-007).

**FR-016: `?lang=` siempre pasado (mecanismo primario)**
THE SYSTEM SHALL siempre pasar el query param `?lang=<locale>` en TODA llamada a la API NestJS como mecanismo PRIMARIO de locale, porque el backend hardcodea el default a `es` y necesita el param para servir otro locale. El header `x-custom-lang` (`APP_HEADER_LANGUAGE`) es una ALTERNATIVA válida solo para casos donde los query params no son ideales, pero `?lang=` es el default y el que se usa en todo el código Astro.

**FR-017: Contenido CMS por locale**
IF el backend NestJS devuelve páginas traducidas para un locale, THEN THE SYSTEM SHALL generar rutas estáticas por cada locale (`/page/[slug]` para `es`, `/en/page/[slug]` para `en`) fetcheando `GET /api/v1/cms/pages/public?lang=<locale>` en build time.

### SEO

**FR-018: Sitemap via @astrojs/sitemap**
THE SYSTEM SHALL generar `sitemap-index.xml` + `sitemap-0.xml` automáticamente vía `@astrojs/sitemap` incluyendo todas las rutas estáticas y dinámicas. THE SYSTEM SHALL eliminar los endpoints `/api/v1/sitemap/*` del backend y cualquier sitemap en Nuxt (decisión usuario: una sola fuente de verdad). Las rutas de sitemap se cachean con un tag `sitemap` dedicado para permitir purge on-demand.

**FR-019: RSS feed**
THE SYSTEM SHALL servir `rss.xml` con los posts publicados (no draft) vía `@astrojs/rss`, fetcheando desde `GET /api/v1/cms/blog/posts/public?lang=<locale>` en build/render time.

**FR-020: Meta tags SEO**
THE SYSTEM SHALL generar meta tags `<title>`, `<meta description>`, OpenGraph y Twitter cards en todas las páginas vía `astro-seo`.

**FR-021: JSON-LD**
THE SYSTEM SHALL emitir JSON-LD por tipo de página: `Organization`+`WebSite` en `/`, `Blog` en `/blog`, `BlogPosting`+`BreadcrumbList` en `/blog/[slug]`, `WebPage` en `/page/[slug]`. THE SYSTEM SHALL obtener plantillas JSON-LD via `GET /api/v1/cms/seo/template/:type`.

**FR-022: SEO metadata desde backend**
THE SYSTEM SHALL obtener SEO metadata por entidad via `GET /api/v1/cms/seo/:entityName/:entityId?lang=<locale>` y por página via `GET /api/v1/cms/seo/:pageId?lang=<locale>` en build/render time, renderizando meta tags desde la respuesta.

**FR-023: OG images**
THE SYSTEM SHALL generar imágenes OG dinámicas por post (PNG) en `public/og/` o vía Satori.

### Render e islands

**FR-024: Islands Vue explícitos**
WHEN una página requiera interactividad, THE SYSTEM SHALL hidratar un island Vue con directivas `client:load`, `client:visible` o `client:idle` según necesidad, manteniendo 0 JS en el resto de la página. Islands: `ContactForm.vue`, `BlogSearch.vue`.

### Contacto — extensión `web` backend (SIN persistencia)

**FR-030: Extensión `web` auto-discovered**
THE SYSTEM SHALL crear la extensión `web` en `apps/back/src/extensions/web/` via `pnpm generate:extension -- --name=web`, con `extension.module.ts` auto-discovered por `ExtensionLoaderModule` (NO se edita `app.module.ts`).

**FR-031: Sin persistencia de mensajes de contacto**
THE SYSTEM SHALL NO persistir mensajes de contacto en la base de datos. No existe tabla `ext_web_contact_message`, no existe migración. El endpoint `POST /api/v1/contact` solo valida el DTO, invoca `MailService.contactFormNotification()`, y responde `201 Created` (o `500` si falla el envío). Sin GDPR/retention concerns porque nada se almacena. La extensión `web` sigue siendo auto-discovered via `extension.module.ts` y existe para consistencia con el patrón del monorepo y futura newsletter (Q-019, fase futura).

**FR-032: Endpoint POST /api/v1/contact**
THE SYSTEM SHALL exponer `POST /api/v1/contact` (sin auth, público) que reciba DTO `{ name: string, email: string, message: string, lang?: string }`, valide con class-validator, invoque `MailService.contactFormNotification()` y responda `201 Created` con `{ success: true }`. WHEN el envío de email falla (SMTP caído, template render error), THE SYSTEM SHALL responder `500 Internal Server Error` (NO 201 silencioso — R-CONTACT-2).

**FR-033: Rate limit contacto**
THE SYSTEM SHALL aplicar `@Throttle(5, 60_000)` al endpoint `POST /api/v1/contact` (5 requests por minuto por IP), override del rate limit global de 1000 req/min. WHEN el límite se excede THE SYSTEM SHALL responder `429 Too Many Requests` con header `Retry-After`.

**FR-034: MailService.contactFormNotification()**
THE SYSTEM SHALL añadir método `contactFormNotification(name, email, message, lang?)` a `MailService` que renderice la plantilla Maizzle `contact-notification.hbs` y envíe el email a la dirección configurada en `app.notificationEmail` (config ya existente en `app-config.type.ts`). WHEN la renderización o el envío falla, THE SYSTEM SHALL lanzar una excepción (catch upstream en el controller responde 500).

**FR-035: Plantilla Maizzle contact-notification**
THE SYSTEM SHALL crear la plantilla Maizzle `contact-notification.hbs` con el layout del email de notificación de contacto (nombre, email, mensaje, timestamp, locale). La ubicación exacta y el pipeline de renderizado se confirman al inicio de Fase 1 inspeccionando el directorio Maizzle existente en el backend (Q-020, investigación de 5 min, no bloqueante — seguir patrón existente de MailService).

**FR-036: ContactForm island**
THE SYSTEM SHALL proveer un island `ContactForm.vue` en `apps/web/src/components/islands/` con campos name, email, message, honeypot oculto, validación client-side (Zod), submit a `POST /api/v1/contact`, estados loading/success/error, y mensaje de error localizado. WHEN el honeypot field se rellena THE SYSTEM SHALL enviar el request de todas formas y el backend descarta silenciosamente (FR-031 + NFR-042 — respuesta 201 false silent al bot, NO se envía email).

### ISR DIY — Astro 7 `Astro.cache` + `routeRules` + webhook

**FR-039: Config `routeRules` con cache por patrón de ruta**
THE SYSTEM SHALL configurar `routeRules` en `astro.config.mjs` declarando cache por patrón de ruta: `/` con `maxAge: 3600, swr: 60, tags: ['home']`; `/blog` y `/blog/**` con `maxAge: 300, swr: 60, tags: ['blog']` (+ `blog-index` para el index); `/page/**` con `maxAge: 600, swr: 60, tags: ['pages']`; `/blog/search` con `cache: false` (island client-side, NO cacheado); rutas de sitemap con `tags: ['sitemap']`. El cache vive en memoria del proceso Node (Coolify container).

**FR-040: Webhook endpoint de revalidación (purge por tag)**
THE SYSTEM SHALL exponer `POST /api/revalidate` en Astro (`apps/web/src/pages/api/revalidate.ts`) que reciba `{ event, payload, timestamp }` con header `X-Revalidate-Signature`, verifique la firma HMAC-SHA256 + timestamp < 5 min (FR-041), mapee el evento a tags (FR-043), y purgue el cache por tag via `Astro.cache` API (Astro 7 stable): `await Astro.cache.delete(tag)` por cada tag. El purge por tag invalida atómicamente todas las rutas cacheadas con ese tag; las rutas re-fetchean lazy en la próxima request (SWR sirve stale meanwhile).

**FR-041: Seguridad webhook ISR (HMAC-SHA256 + timestamp + 5 min window)**
THE SYSTEM SHALL verificar la firma HMAC-SHA256 del webhook ISR usando el secret en `REVALIDATE_SECRET` env var (compartido entre NestJS y Astro, estático, rotación manual solo si se compromete — NO JWT, overkill para este caso). El webhook payload incluye un `timestamp` (ISO 8601); THE SYSTEM SHALL rechazar webhooks con timestamp older than 5 min (previene replay attacks). WHEN la firma es inválida, ausente, o el timestamp expiró THE SYSTEM SHALL responder `401 Unauthorized` y loguear el intento.

**FR-042: CMS dispara webhook con firma HMAC**
WHEN un admin publique, edite o despublique un post/página/categoría/tag en NestJS, THE SYSTEM SHALL invocar `POST <ASTRO_URL>/api/revalidate` con payload `{ event: 'post.published'|'post.updated'|'post.unpublished'|'page.updated'|'category.updated'|'tag.updated', payload: { slug, categoryId, tagSlugs, ... }, timestamp: <ISO 8601> }` y header `X-Revalidate-Signature: <HMAC-SHA256(REVALIDATE_SECRET, JSON.stringify(body))>`.

**FR-043: Mapa evento → tags (Q-017 RESUELTA)**
THE SYSTEM SHALL mapear eventos CMS a tags a purgar (Q-017 RESUELTA, mapa confirmado):

| Evento CMS | Tags purgados (Astro.cache.delete) | Rutas afectadas (lazy re-fetch) |
|------------|-----------------------------------|---------------------------------|
| `post.published` / `post.updated` / `post.unpublished` | `blog`, `sitemap` | `/blog/[slug]`, `/blog`, `/blog/c/[categoryId]`, `/blog/category/[categorySlug]`, `/blog/tag/[tagSlug]` (por cada tag del post), `/sitemap-index.xml`, `/sitemap-0.xml` |
| `page.updated` | `pages`, `sitemap` (+ `home` si PageSection='landing') | `/page/[slug]`, `/` (si landing), sitemaps |
| `category.updated` | `blog`, `sitemap` | `/blog/c/[slug]`, `/blog/category/[slug]`, `/blog`, sitemaps |
| `tag.updated` | `blog`, `sitemap` | `/blog/tag/[slug]`, `/blog`, sitemaps |

> `/blog/search` NO se revalida — es client-side island, fetchea en runtime, sin cache server-side.

**FR-044: Purge parcial por tag (no full rebuild)**
THE SYSTEM SHALL purgar SOLO los tags mapeados al evento via `Astro.cache.delete(tag)`, NO disparar full rebuild del sitio. Los tags no purgados permanecen en cache; sus rutas sirven cache instantáneo. Las rutas con tags purgados re-fetchean lazy en la próxima request (SWR sirve stale meanwhile).

### Deploy

**FR-050: Build SSR con ISR DIY**
WHEN se ejecute `astro build`, THE SYSTEM SHALL producir `dist/server/entry.mjs` (proceso Node standalone) servible desde Coolify via `node ./dist/server/entry.mjs` exponiendo puerto 4321, con soporte para purge de cache on-demand via el endpoint `/api/revalidate` y `Astro.cache`.

**FR-051: Deploy dual independiente**
THE SYSTEM SHALL desplegar `apps/web/` y `apps/front/` en pipelines CI/CD separados con triggers independientes (push a `apps/web/**` o `apps/front/**` respectivamente), via Coolify. Config Coolify para Astro SSR: adapter `@astrojs/node`, unchecked "Is it a static site?", start command `node ./dist/server/entry.mjs`, expose port 4321.

## Requisitos no funcionales (NFR-NNN)

### Performance

**NFR-001: Lighthouse performance landing**
THE SYSTEM SHALL rendir landing con Lighthouse performance score >= 95.

**NFR-002: Cero JS landing**
THE SYSTEM SHALL servir landing con JS payload < 10 KB (idealmente 0 KB salvo fonts/preload). El island `ContactForm.vue` solo hidrata cuando el usuario interactúa (`client:visible`).

**NFR-003: Core Web Vitals**
THE SYSTEM SHALL cumplir LCP < 2.5 s, CLS < 0.1, INP < 200 ms en landing.

### SEO

**NFR-004: URLs consistentes**
THE SYSTEM SHALL mantener las mismas URLs públicas que el sitio Nuxt actual (`/blog/[slug]`, `/page/[slug]`) para preservar ranking SEO. Si alguna URL cambia, THE SYSTEM SHALL emitir redirect 301.

**NFR-005: Sitemap válido**
THE SYSTEM SHALL servir `sitemap-index.xml` accesible en `https://midominio.com/sitemap-index.xml` con todas las URLs canónicas. THE SYSTEM SHALL NO servir sitemap desde backend ni Nuxt.

### Accesibilidad

**NFR-006: WCAG AA**
THE SYSTEM SHALL cumplir WCAG 2.1 AA en todas las páginas públicas (contraste, navegable por teclado, alt en imágenes, ARIA donde aplique). El formulario de contacto debe ser navegable por teclado y tener labels asociados.

### i18n

**NFR-007: Fallback estático si backend cae**
WHEN la API NestJS no esté disponible en build time, THE SYSTEM SHALL generar el sitio usando fallback estático es/en de `apps/web/src/i18n/{es,en}.json`. Build acoplado a backend por defecto, con fallback graceful.

### Seguridad

**NFR-008: Sin secrets en bundle**
THE SYSTEM SHALL NO incluir tokens, claves ni secrets en el bundle de Astro. Solo vars `PUBLIC_*` expuestas al cliente. `REVALIDATE_SECRET` se usa server-side en el endpoint `/api/revalidate`, nunca en client.

**NFR-009: CORS via FRONTEND_DOMAINS**
THE SYSTEM SHALL configurar CORS en NestJS via la env var `FRONTEND_DOMAINS` (CSV), agregando el dominio de Astro. NO requiere code change — solo env update.

**NFR-040: ISR webhook seguridad HMAC-SHA256 + timestamp + 5 min window**
THE SYSTEM SHALL firmar el webhook ISR con HMAC-SHA256 usando `REVALIDATE_SECRET` (env var estático, compartido entre NestJS y Astro, rotación manual solo si se compromete — NO JWT). El webhook payload incluye `timestamp` (ISO 8601); THE SYSTEM SHALL rechazar webhooks con timestamp older than 5 min (previene replay attacks, Q-016 RESUELTA). THE SYSTEM SHALL rechazar webhooks sin firma válida (401). El secret NO rota automáticamente — solo rota si el usuario lo decide tras una compromisión.

**NFR-041: Latencia revalidación < 60s**
THE SYSTEM SHALL completar la purga de cache por tag en < 60s desde que el CMS dispara el webhook (medido desde POST /api/revalidate hasta que `Astro.cache.delete(tag)` retorna OK). El re-fetch lazy de rutas ocurre en la próxima request (SWR sirve stale meanwhile), no cuenta para esta latencia.

**NFR-042: Contacto spam protection (honeypot)**
THE SYSTEM SHALL proteger el formulario de contacto contra spam más allá del rate limit: honeypot field oculto (Q-018 decide si se añade captcha además, recomendado honeypot solo en Fase 1). WHEN el honeypot field se rellena THE SYSTEM SHALL descartar el mensaje silenciosamente (respuesta 201 false silent al bot, NO se envía email). WHEN el envío real falla (SMTP, template), THE SYSTEM SHALL responder 500 (error legítimo, distinto path del honeypot). Los dos flujos son distintos y no conflictúan (R-CONTACT-2 clarificación).

### Mantenibilidad

**NFR-010: TypeScript estricto**
THE SYSTEM SHALL compilar ambos apps con `pnpm check-types` sin errores en pipelines CI.

**NFR-011: Lint passing**
THE SYSTEM SHALL pasar `pnpm lint` (eslint + prettier) en ambos apps sin errores.

### Build determinismo

**NFR-012: Build reproducible con mismo backend state**
WHEN el mismo commit se buildée dos veces con el mismo estado de backend, THE SYSTEM SHALL producir output idéntico (salvo timestamps generados).

## Criterios de aceptación por requisito complejo

- **FR-006**: Given una página CMS publicada con slug `about` en NestJS; When se ejecuta `astro build`; Then existe `dist/server/` con la ruta `/page/about` servible; Then GET `/page/about` sirve HTML de la página (cacheado, tag `pages`).
- **FR-031**: Given usuario envía `{ name: "Ada", email: "ada@example.com", message: "Hola" }`; When POST /api/v1/contact; Then 201 Created; Then email llega a `app.notificationEmail`; Then NO existe tabla `ext_web_contact_message` en DB; Then NO existe migración para contacto.
- **FR-032**: Given SMTP caído o template render error; When POST /api/v1/contact con DTO válido; Then 500 Internal Server Error (NO 201 silencioso).
- **FR-033**: Given 5 requests en 60s desde misma IP; When 6ª request; Then 429 con `Retry-After`.
- **FR-039**: Given `astro.config.mjs` con `routeRules`; When GET `/blog/foo`; Then response cacheada con tag `blog` por 300s + SWR 60s; When GET `/blog/search?q=foo`; Then response NO cacheada (cache: false).
- **FR-041**: Given webhook con timestamp older than 5 min; When POST /api/revalidate; Then 401 Unauthorized (timestamp expired). Given webhook con firma inválida; When POST /api/revalidate; Then 401 Unauthorized.
- **FR-043**: Given admin edita post `foo` (categoryId `cat-1`, tagSlugs `['tag-a','tag-b']`) en CMS; When CMS dispara webhook `post.updated` con firma HMAC + timestamp < 5 min; Then Astro purga tags `blog` + `sitemap`; Then próxima request a `/blog/foo` re-fetchea lazy; Then próxima request a `/page/about` sirve cache (tag `pages` NO purgado, no re-fetch).
- **FR-044**: Given full rebuild tarda 5 min; When post editado; Then solo tags `blog` + `sitemap` purgados en < 60s; Then tags `pages`, `home` NO purgados, sus rutas sirven cache sin re-fetch.
- **NFR-004**: Given URL `/blog/mi-post` existe en Nuxt actual; When migra a Astro; Then `/blog/mi-post` sirve el mismo contenido desde Astro; Then no hay redirect 301 innecesario.

## Pendientes de clarificación

- `[NEEDS CLARIFICATION]` Q-018: ¿honeypot solo o honeypot + captcha en contacto? (Recomendado: honeypot solo en Fase 1, hCaptcha si spam persiste).
- `[NEEDS CLARIFICATION]` Q-020: ubicación exacta de `contact-notification.hbs` — se resuelve al inicio de Fase 1 inspeccionando el directorio Maizzle del backend (investigación de 5 min, NO bloqueante).