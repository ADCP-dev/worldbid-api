---
doc: astro-public/08-definition-of-done
title: "Definition of Done"
status: draft
created: 2026-08-20
---

# Definition of Done

Criterios **objetivos** para considerar la migración completa. Cada criterio es verificable automáticamente o por checklist explícito. Los gates se organizan por categoría.

## Por fase (criterios de salida)

Los criterios de salida de cada fase están definidos en `06-migration-phases.md`. Esta sección define el DoD global de toda la migración.

## Tests

| Tipo | Requisito | Verificación |
|------|-----------|--------------|
| Contact form E2E | POST /api/v1/contact con DTO válido → 201, email llega a `app.notificationEmail` | Test E2E Fase 1 |
| Contact form send failure | POST /api/v1/contact con DTO válido pero SMTP caído / template render error → 500 (NO 201 silencioso) | Test E2E Fase 1 |
| Contact no persistencia | NO existe tabla `ext_web_contact_message` ni migración de contacto en DB | Test Fase 1 (verificar schema DB sin tabla) |
| Contact rate limit | 5 requests en 60s OK, 6ª recibe 429 con `Retry-After` | Test automático |
| Contact honeypot | Honeypot field relleno → 201 silencioso (descartado, NO se envía email) | Test automático |
| Contact DTO invalid | Email mal formado / mensaje vacío → 400 Bad Request | Test unit |
| Blog search | /blog/search?q=foo retorna posts que matchean `foo` (client-side, no cacheado) | Test Fase 2 |
| Blog tag filter | /blog/tag/[slug] retorna posts con ese tag | Test Fase 2 |
| Blog category filter | /blog/c/[slug] y /blog/category/[slug] retornan posts de esa categoría | Test Fase 2 |
| Blog related | /blog/[slug] muestra 3 posts relacionados | Test Fase 2 |
| ISR DIY revalidation | Editar post en CMS → webhook purga tags `blog` + `sitemap` en < 60s; próxima request re-fetchea lazy; rutas con tag `pages`/`home` NO se re-fetchean | Test Fase 2 |
| ISR DIY purge by tag | `Astro.cache.delete('blog')` invalida TODAS las rutas cacheadas con tag `blog` (atómico, no full rebuild) | Test Fase 2 |
| ISR security | POST /api/revalidate sin firma → 401; firma inválida → 401; timestamp > 5 min → 401; firma válida + timestamp < 5 min → purga OK | Test Fase 2 |
| Smoke test admin | `/app/**` funciona sin regresiones tras Fase 2 | Login + dashboard + CRUD |
| Build SSR | `pnpm --filter web build` produce `dist/server/entry.mjs` sin errores | CI gate |
| Type-check | `pnpm check-types` pasa en `apps/web`, `apps/front`, `apps/back` | CI gate (NFR-010) |

> No se requiere coverage unit test mínimo para el contenido estático. Si se agregan utilidades en `apps/web/src/lib/` o lógica en islands, cubrirlas con unit tests.

## Lint

| Gate | Comando | Verificación |
|------|---------|--------------|
| ESLint | `pnpm lint` (todas las workspaces) | Sin errores. Warnings permitidos solo con justificación. |
| Prettier | `pnpm format` (check) | Sin diffs (archivos ya formateados). |
| NFR-011 | Cumplir `pnpm lint` passing | CI gate |

## Type-check

| Gate | Comando |
|------|---------|
| TypeScript estricto | `pnpm check-types` pasa en `apps/web`, `apps/front`, `apps/back` |
| NFR-010 | Sin errores de tipos |
| Sin `any` | `rg "\bany\b" apps/web/src apps/back/src/extensions/web` sin resultados en nuevas firmas |

## Build

| Gate | Comando | Output esperado |
|------|---------|------------------|
| Astro build | `pnpm --filter web build` | `apps/web/dist/server/entry.mjs` (proceso Node standalone) |
| Nuxt build | `pnpm --filter front build` | `apps/front/.output/` (sin cambios) |
| NestJS build | `pnpm --filter back build` | `apps/back/dist/` (con extensión `web` nueva, sin tablas DB) |

## Documentación

| Requisito | Verificación |
|-----------|--------------|
| `docs/ARCHITECTURE.md` actualizado | `pnpm docs:sync` ejecutado sin errores (usuario lo ejecuta) |
| Doc extensión `web` | `docs/extensions/web.md` con frontmatter YAML válido (`id: web`, `type: extension`, `dependencies: [auth]`, `entities: []` — sin entidades porque no hay persistencia) |
| PRD actualizado | Open questions resueltas marcadas como `RESUELTA` con fecha y decisión |
| `apps/web/README.md` | Stack (Astro 7, Node 22.12), estructura, scripts, deploy (Coolify SSR), ISR DIY (Astro.cache + routeRules), env vars |

## Deploy

| Criterio | Verificación |
|----------|--------------|
| `apps/web/` desplegado en prod | `https://midominio.com/` sirve landing Astro (HTTP 200) |
| DNS apunta a Astro | `dig midominio.com` resuelve a Coolify |
| Coolify config Astro SSR | Docker, start command `node ./dist/server/entry.mjs`, puerto 4321, "Is it a static site?" unchecked |
| Nuxt admin desplegado | `https://app.midominio.com/app/dashboard` funciona |
| NestJS API desplegado | `https://api.midominio.com/health` responde 200 |
| Pipelines CI/CD separados | Push a `apps/web/**` no dispara deploy de `apps/front/**` y viceversa |
| `FRONTEND_DOMAINS` actualizado | Backend CORS permite `midominio.com` |
| `REVALIDATE_SECRET` set en ambos | NestJS + Astro tienen el mismo secret (env var) |

## Performance (NFR-001, NFR-002, NFR-003)

| Métrica | Target | Verificación |
|---------|--------|--------------|
| Lighthouse performance landing | >= 95 | Lighthouse CI en staging |
| JS payload landing | < 10 KB (ideal 0 KB salvo ContactForm island) | Lighthouse CI |
| LCP landing | < 2.5 s | Lighthouse CI |
| CLS landing | < 0.1 | Lighthouse CI |
| INP landing | < 200 ms | Lighthouse CI |
| ISR DIY purge latency | < 60 s desde webhook a `Astro.cache.delete(tag)` OK | Test Fase 2 |

## SEO (NFR-004, NFR-005)

| Criterio | Verificación |
|----------|--------------|
| URLs consistentes | Mismas rutas que Nuxt actual (`/blog/[slug]`, `/page/[slug]`). Sin 404. |
| Sitemap válido | `https://midominio.com/sitemap-index.xml` accesible, parsea sin errores |
| Sitemap único | Backend NO sirve `/api/v1/sitemap/*` (curl 404); Nuxt no genera sitemap |
| RSS válido | `https://midominio.com/rss.xml` accesible, validador RSS sin errores |
| JSON-LD válido | Schema.org validator sin errores en `/`, `/blog`, `/blog/[slug]` |
| OG images | Generadas por post en `public/og/` o Satori |
| Redirects 301 | Solo si URL cambia. Log de redirects en CI. |
| Audit SEO pre/post | Pre-migración: snapshot URLs + rankings. Post: mismo snapshot + diff. |

## Accesibilidad (NFR-006)

| Criterio | Verificación |
|----------|--------------|
| WCAG 2.1 AA | Lighthouse Accessibility >= 95 + axe-core scan sin errores críticos |
| Navegable por teclado | Tab a través de landing + blog post + contacto sin traps |
| Contacto accesible | Labels asociados, `aria-live` para errores, focus visible |
| Contraste AA | Lighthouse + manual en componentes clave |

## Seguridad (NFR-008, NFR-009, NFR-040, NFR-042)

| Criterio | Verificación |
|----------|--------------|
| Sin secrets en bundle | `rg "SECRET\|API_KEY\|JWT_SECRET\|REVALIDATE_SECRET" apps/web/dist/` sin resultados |
| CORS whitelist NestJS | `FRONTEND_DOMAINS` env var lista `midominio.com,app.midominio.com` |
| ISR webhook HMAC + timestamp | POST /api/revalidate sin firma → 401; firma inválida → 401; timestamp > 5 min → 401; firma válida + timestamp < 5 min → purga OK |
| Contacto rate limit | 5 req/60s por IP, 6ª → 429 con `Retry-After` |
| Contacto honeypot | Honeypot relleno → 201 false silent (descartado, NO email); falla real envío → 500 |
| Sin `localStorage` tokens en Astro | Astro no maneja auth — confirmado por grep |

## Extensión `web` (FR-030 a FR-036, SIN DB)

| Criterio | Verificación |
|----------|--------------|
| `web` extension auto-discovered | Backend arranca sin editar `app.module.ts` — verificar `extension.module.ts` detectado |
| Sin tablas `ext_web_*` | NO existe tabla `ext_web_contact_message` ni migración de contacto (FR-031) |
| POST /api/v1/contact funciona | DTO válido → 201 + email; DTO inválido → 400; SMTP failure → 500 |
| Rate limit 5/min | Test: 6ª request → 429 |
| MailService.contactFormNotification | Método existe, renderiza `contact-notification.hbs`, envía a `app.notificationEmail` |
| Maizzle template | `contact-notification.hbs` existe y renderiza sin errores (ubicación confirmada por Q-020 al inicio de Fase 1) |

## ISR DIY — Astro 7 `Astro.cache` + `routeRules` (FR-039 a FR-044)

| Criterio | Verificación |
|----------|--------------|
| `routeRules` config | `astro.config.mjs` define cache por patrón con `maxAge` + `swr` + `tags` (FR-039) |
| Cache en memoria proceso Node | `/blog/foo` segunda request sirve cache (no re-fetch NestJS) |
| `/blog/search` no cacheado | `routeRules` `cache: false` para `/blog/search` (island client-side) |
| Endpoint `/api/revalidate` purge por tag | `Astro.cache.delete('blog')` invalida todas las rutas con tag `blog` (atómico) |
| Webhook HMAC + timestamp | POST /api/revalidate con firma válida + timestamp < 5 min → purga; sin firma → 401; timestamp > 5 min → 401 |
| Mapa evento→tag | FR-043 implementado: `post.*` → `blog` + `sitemap`; `page.updated` → `pages` + `sitemap` (+ `home` si landing); `category.updated` → `blog` + `sitemap`; `tag.updated` → `blog` + `sitemap` |
| Purge parcial (no full rebuild) | Editar post → solo tags `blog` + `sitemap` purgados; tag `pages` NO purgado, `/page/about` sirve cache |
| `/blog/search` no revalidado | Webhook `post.updated` NO purga nada que afecte `/blog/search` (client-side, no cacheado) |

## Sitemap removal (FR-018)

| Criterio | Verificación |
|----------|--------------|
| Grep check pre-eliminación | `rg '/api/v1/sitemap' apps/front/ apps/back/` ejecutado; si Nuxt consume, documentar follow-up y NO eliminar hasta coordinar |
| Backend sin /api/v1/sitemap/* | `curl https://api.midominio.com/api/v1/sitemap/blog` → 404 |
| Nuxt sin sitemap | grep `sitemap` en `apps/front/` no genera sitemap |
| Astro genera sitemap | `curl https://midominio.com/sitemap-index.xml` → 200 XML válido |
| Sin referencias rotas | `rg "/api/v1/sitemap" apps/back/ apps/front/` sin resultados (salvo migración revertida) |

## Verificación final (checklist)

- [ ] Todos los FR-NNN relevantes cumplidos (ver `03-requirements.md`)
- [ ] Todos los NFR-NNN cumplidos
- [ ] Open questions bloqueantes Q-016 (HMAC + timestamp) y Q-017 (mapa evento→tag) resueltas
- [ ] Q-020 (ubicación Maizzle) resuelta al inicio de Fase 1 (inspección 5 min)
- [ ] Tests gate passing
- [ ] Lint + type-check passing
- [ ] Build passing en todas las apps
- [ ] Docs actualizadas + `pnpm docs:sync` ejecutado (usuario lo ejecuta)
- [ ] Deploy en prod funcional (web + admin + API)
- [ ] Lighthouse passing en prod
- [ ] SEO audit post-migración sin regresiones
- [ ] Extensión `web` auto-discovered (no app.module.ts edit)
- [ ] **NO existe tabla `ext_web_contact_message` ni migración de contacto** (FR-031, sin persistencia)
- [ ] Backend + Nuxt sitemap endpoints removed (con grep check previo)
- [ ] Contact form E2E: POST 201, email arrives, rate limit 5/min enforced, send failure → 500 (no 201 silencioso)
- [ ] Blog search/tags/category filters return correct results
- [ ] ISR DIY verified: edit post → webhook purga tags `blog` + `sitemap` en < 60s via `Astro.cache.delete`, NOT full rebuild, `/blog/search` no afectado
- [ ] Decisiones clave guardadas en Engram (`mem_save`)

## Out of DoD (no aplica)

- Migración de auth a httpOnly cookies (fuera de scope).
- Implementación ecommerce (fuera de scope).
- Migración del backoffice admin a otra tecnología (fuera de scope).
- Limpieza de Nuxt (`modules/landing/`, `extensions/cms/pages/{blog,page}`) (fuera de scope — este PRD no limpia Nuxt).
- Creación de `packages/ui` (fuera de scope — cada app maneja sus tokens).
- Newsletter (fase futura, no implementada ahora — Q-019).
- Cache distribuido Redis (out-of-scope — cache en memoria proceso Node basta para 1 container).

## Criterios de no-aceptación (anti-DoD)

- ❌ Landing con JS payload de auth/TanStack/i18n hook (debe ser < 10 KB).
- ❌ Contacto que persiste mensajes en DB (FR-031: sin persistencia, solo email).
- ❌ Contacto que envía email sin rate limit (DoS del inbox).
- ❌ Contacto que responde 201 silencioso cuando falla el envío real (R-CONTACT-2 no mitigado — debe ser 500).
- ❌ Contacto que responde 500 cuando honeypot se rellena (debe ser 201 false silent al bot).
- ❌ ISR que hace full rebuild en cada edición (debe ser purge por tag via `Astro.cache`).
- ❌ ISR webhook sin HMAC-SHA256 + timestamp (spoofing/replay posible — R-ISR-1, NFR-040).
- ❌ ISR webhook con timestamp > 5 min aceptado (replay attack — NFR-040).
- ❌ Sitemap servido desde backend o Nuxt (debe ser solo Astro).
- ❌ `console.log` en backend (usar NestJS Logger).
- ❌ Migración SQL escrita a mano (usar `pnpm migration:generate`).
- ❌ Extensión `web` que requiere editar `app.module.ts` (debe ser auto-discovered).
- ❌ Tabla de extensión `web` con prefijo distinto a `ext_web_` (si se añaden tablas futuras, ej: newsletter).
- ❌ Webhook ISR sin HMAC (spoofing posible — R-ISR-1).
- ❌ Webhook ISR con JWT en lugar de HMAC (overkill — NFR-040 especifica HMAC-SHA256).
- ❌ Llamadas a API NestJS sin `?lang=` (backend hardcodea default 'es').
- ❌ Cache en Redis u otra infra distribuida (overkill para 1 container — R-COOLIFY-1).
- ❌ Eliminar endpoints `/api/v1/sitemap/*` del backend sin grep check previo (R6).

## Resumen de gates por fase

| Fase | Gates críticos |
|------|----------------|
| 0 | Astro 7 build SSR (`dist/server/entry.mjs`), `routeRules` cachea `/`, ISR endpoint 401 sin firma o timestamp > 5 min, check-types + lint, Node 22.12 |
| 1 | Landing Lighthouse >= 95, contacto E2E (201 + email + 429 + 500 en send failure + 201 false en honeypot), ext web auto-discovered, **sin tabla `ext_web_contact_message`** |
| 2 | Blog search/tag/category correctos, ISR DIY purge por tag < 60s (`Astro.cache.delete`), `/blog/search` no afectado, sitemap solo en Astro (con grep check previo), admin sin regresiones |