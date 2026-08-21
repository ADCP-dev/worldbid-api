---
doc: astro-public/01-overview
title: "Overview"
status: draft
created: 2026-08-20
---

# Astro Public App — Overview

## Resumen ejecutivo

Foundation separa la **web pública** del **backoffice admin**. El backoffice se queda en Nuxt (`apps/front/`) porque es una app interactiva con auth client-side, TanStack Query y componentes pesados (Tiptap, Kanban, Calendar, DataTable). La web pública migra a **Astro 7** (`apps/web/`) porque es contenido con foco en SEO, performance y cero JS por defecto. Patrón arquitectural: **BFF separation + SSR static-first con ISR DIY**.

La web pública incluye: landing (con formulario de contacto), blog editorial (con filtro por categoría, tags y búsqueda full-text), páginas CMS, SEO completo (sitemap, RSS, JSON-LD, OG images) e i18n es/en consumiendo la API NestJS. Se añade una nueva extensión backend `web` para el endpoint de contacto con notificación por email y rate limiting. La estrategia de cache es **ISR DIY con Astro 7 `Astro.cache` + `routeRules`** (ambos STABLE en v7, experimentales en v6). Astro NO tiene ISR nativo como Next.js; la combinación de `routeRules` (declarativa: `maxAge` + `swr` + `tags` por patrón de ruta) + `Astro.cache` API (purge por tag desde el endpoint `/api/revalidate`) hace viable ISR DIY sin middleware custom. El cache vive en memoria del proceso Node (Coolify container); si el container restartea, el cache se regenera en la próxima request (cold start aceptable para un proyecto de 1 container).

```
        ┌──────────────────┐
        │   NestJS API     │
        │   apps/back/     │
        │   + ext web      │
        └────────┬─────────┘
                 │ REST /api/v1
        ┌────────┴─────────┐
        │                  │
┌───────▼────────┐  ┌─────▼──────────┐
│  Nuxt admin    │  │  Astro web     │
│  apps/front/   │  │  apps/web/     │
│  /app/**       │  │  / /blog /page│
│  Node server   │  │  SSR Node +    │
│  Auth client   │  │  Astro.cache   │
└────────────────┘  │  ISR DIY       │
                    └────────────────┘
```

> Astro 7 adquirido por Cloudflare en enero 2026 (informativo, sin acción arquitectural — el deploy sigue en Coolify self-hosted).

## Problema / motivación

Nuxt layers no tienen boundaries reales. La landing "liviana" arrastra auth store, TanStack Query, i18n hook con fetch a backend en startup, build dual Node+SSG, y rutas con `prerender:false` que obligan a correr Node server en runtime. Backoffice es APP (Nuxt correcto); web pública es CONTENIDO (Astro correcto). Tools distintas para naturalezas distintas.

Adicionalmente, no existe un endpoint de contacto público: el backend no tiene una extensión `web` que reciba mensajes del formulario público y notifique por email. Hay que crearla.

Por último, el sitemap se genera hoy desde el backend (`/api/v1/sitemap/blog`, `/api/v1/sitemap/pages`) y posiblemente duplicado en Nuxt. La decisión del usuario es centralizarlo en Astro (`@astrojs/sitemap`) y eliminarlo del backend y de Nuxt para reducir duplicación.

## Objetivos (medibles)

| # | Objetivo | Criterio de éxito |
|---|----------|-------------------|
| O1 | Definir arquitectura target con 3 apps (back, front admin, web pública) y responsabilidades claras | `02-architecture.md` aprobado |
| O2 | Especificar `apps/web/` Astro 7: stack, estructura, ISR DIY (Astro.cache + routeRules), deploy | `03-requirements.md` + `02-architecture.md` |
| O3 | Implementar formulario de contacto con extensión `web` backend + notificación email (sin persistencia) | POST /api/v1/contact retorna 201, email llega, rate limit 5/min enforced |
| O4 | Implementar blog con filtro categoría + tags + búsqueda full-text | /blog/tag/[slug], /blog/search retornan resultados correctos |
| O5 | Definir estrategia i18n consumiendo /translations/* con `?lang=` siempre | Cubierto en `03-requirements.md` sin `[NEEDS CLARIFICATION]` |
| O6 | Plan de migración incremental en 3 fases sin big-bang | Fases 0-2 con criterios de salida y rollback en `06-migration-phases.md` |
| O7 | Centralizar sitemap en Astro y eliminar del backend + Nuxt | `@astrojs/sitemap` generado, endpoints backend removidos, Nuxt sin sitemap |

## No-objetivos (out-of-scope)

- Migración del backoffice admin (se queda en Nuxt).
- Refactor del backend NestJS (solo ajustes mínimos: CORS via `FRONTEND_DOMAINS`, nueva extensión `web`).
- Migración de auth a httpOnly cookies (fuera de scope — el draft Q-004 se descarta).
- Implementación de ecommerce (fuera de scope — el draft Q-012 se descarta).
- Limpieza de Nuxt (`modules/landing/`, `extensions/cms/pages/{blog,page}`) — fuera de scope (el draft Fase 4 se descarta).
- Creación de `packages/ui/` design tokens compartidos — fuera de scope (el draft Q-007 se descarta).
- Port directo de componentes Vue a Astro (se reescriben).
- Newsletter (documentada como fase futura en la extensión `web`, NO implementada ahora — Q-019).
- Cache distribuido (Redis) — overkill para 1 container Coolify; cache en memoria del proceso Node basta.

## KPIs / métricas de éxito

| Métrica | Target | Verificación |
|---------|--------|--------------|
| Landing en Astro desplegada | `apps/web/` sirve `/` en producción | Deploy Fase 1 |
| Cero JS en landing | Lighthouse "Eliminate render-blocking" 100, JS payload < 10 KB | Lighthouse CI |
| Core Web Vitals | LCP < 2.5 s, CLS < 0.1, INP < 200 ms | Lighthouse CI |
| Blog migrado | `/blog/**` servido desde Astro | Fase 2 |
| Contacto E2E | POST /api/v1/contact retorna 201, email llega, 6ª petición en 60s recibe 429 | Test E2E Fase 1 |
| Búsqueda blog | /blog/search?q=foo retorna posts que matchean | Test Fase 2 |
| Filtro tags | /blog/tag/[slug] retorna posts con ese tag | Test Fase 2 |
| ISR revalidación | Editar post en CMS → webhook purga tag `blog` en < 60s, rutas re-cachedean lazy, sin full rebuild | Test Fase 2 |
| Sitemap único | Astro genera sitemap, backend + Nuxt ya no sirven sitemap | grep + curl Fase 2 |
| Backoffice sin regresiones | `/app/**` intacto en Nuxt | Smoke test post-Fase 2 |
| SEO | Sitemap + RSS + JSON-LD + OG images generados desde Astro | `03-requirements.md` FR-012 a FR-016 |

## Próximos pasos

1. Q-016 (HMAC + timestamp) y Q-017 (mapa evento→ruta) RESUELTAS en `07-open-questions.md`.
2. Q-020 (ubicación plantilla Maizzle) queda PENDIENTE no bloqueante — se resuelve al inicio de Fase 1 (inspección de 5 min del directorio Maizzle).
3. Asignar owner (Q-015).
4. Aprobar Fase 0 (setup) en `06-migration-phases.md`.