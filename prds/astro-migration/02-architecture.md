---
doc: astro-migration/02-architecture
title: "Arquitectura Target y Decisiones"
status: draft
created: 2026-07-07
---

# Arquitectura Target y Decisiones

## Diagrama target

```
                    ┌──────────────────────────┐
                    │      NestJS API          │
                    │      apps/back/          │
                    │  PostgreSQL + TypeORM    │
                    │  Bull queues + Nodemailer│
                    └─────────────┬────────────┘
                                  │ REST /api/v1
                    ┌─────────────┴────────────┐
                    │                          │
        ┌───────────▼──────────┐   ┌───────────▼──────────┐
        │   Nuxt admin         │   │   Astro web          │
        │   apps/front/        │   │   apps/web/          │
        │                      │   │                      │
        │   Backoffice puro    │   │   Web pública        │
        │   /app/**            │   │   / /blog /page      │
        │   Node server        │   │   Estático Coolify  │
        │   Auth client-side   │   │   0 JS por defecto   │
        │   TanStack Query     │   │   Islands Vue       │
        │   Tiptap/Kanban/Cal  │   │   Blog vía API       │
        └──────────┬───────────┘   └──────────┬───────────┘
                   │                          │
                    └──────────────┬───────────┘
                                   │
                     ┌─────────────▼────────────┐
                     │    packages/ui/          │
                     │  Design tokens (sin dark)│
                     │  Tailwind preset + DaisyUI│
                     └──────────────────────────┘
```

> Deploy via Coolify (self-hosted PaaS, Docker + Nginx reverse proxy). Sin CDN edge externo.

## Estructura del monorepo

| Path | Rol | Stack |
|------|-----|-------|
| `apps/back/` | API, corazón del negocio | NestJS + TypeORM + PostgreSQL |
| `apps/front/` | Backoffice admin (reducido) | Nuxt 3 + Vue 3 + Pinia + TanStack |
| `apps/web/` | Web pública | Astro + Tailwind 4 + DaisyUI 5 |
| `packages/ui/` | Design tokens compartidos | Tailwind preset + DaisyUI theme + JSON tokens |

## Responsabilidades por app

### `apps/back/` (NestJS)

- API REST `/api/v1/**`.
- Auth (JWT, refresh, roles, RBAC).
- CMS admin (CRUD blog posts, pages).
- Webhooks, email, storage.
- Extensiones: cms, crm, affiliate, content-pipeline, autonomous-agent, stripe, upload-post.
- **Sin cambios arquitecturales.** Solo sirve API.

### `apps/front/` (Nuxt admin)

- Backoffice interactivo `/app/**`.
- Dashboard, users, settings, cms admin, crm, affiliate, content-pipeline, autonomous-agent, stripe, upload-post.
- Auth client-side (Pinia + `localStorage` + JWT + refresh).
- TanStack Query para cache.
- Componentes pesados: Tiptap, Kanban, Calendar, DataTable.
- **Post-migración**: admin puro, sin landing ni blog.

### `apps/web/` (Astro)

- Landing `/`.
- Blog `/blog/**` (vía API NestJS en build time — Q-003).
- Páginas CMS `/page/**`.
- Futuro ecommerce público `/tienda/**`.
- SEO: sitemap, RSS, JSON-LD, OG images.
- i18n es/en (Modo B: build-time fetch backend — Q-005).
- **0 JS por defecto**, islands explícitos donde interactividad necesaria.
- Auth pages (`/login`, `/register`, etc.) **se quedan en Nuxt** (forms interactivos, auth client-side). Astro no maneja auth.

### `packages/ui/`

- Tailwind preset (colores, tipografía, spacing, breakpoints).
- DaisyUI theme (sin variantes dark — Q-014).
- Tokens en JSON (source of truth). Sin variantes light/dark.
- **NO componentes.** Cada app construye los suyos consumiendo el preset. Principio: *shared tokens, not shared components.*

## Flujo de datos

### Astro ↔ NestJS

- **Build time**: Astro fetchea contenido CMS (blog posts, pages) y strings UI (i18n) vía API. CMS es fuente única (Q-003).
- **Runtime (islands)**: interactividad opcional (ej. carrito ecommerce, form newsletter) llama a API.
- Sin estado de sesión en Astro (contenido público).

### Nuxt ↔ NestJS

- **Runtime**: SPA cliente llama a `/api/v1/**` con JWT.
- Auth 100% client-side. Refresh automático. Refresh-on-401 en `useApi`.
- Sin cambios respecto a estado actual.

## Estructura interna `apps/web/`

```
apps/web/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── tailwind.config.ts          # importa preset de @foundation/ui
├── public/{favicon.ico,og/,fonts/}
└── src/
    ├── pages/
    │   ├── index.astro              # landing /
    │   ├── blog/{index,[slug],c/[slug],category/[slug]}.astro
    │   ├── page/[slug].astro        # CMS pages
    │   ├── tienda/                  # futuro ecommerce (Fase 3)
    │   └── {404,500}.astro
    ├── layouts/{BaseLayout,PublicLayout,BlogLayout}.astro
    ├── components/
    │   ├── landing/                 # migrados de modules/landing/ (16 componentes)
    │   ├── blog/{PostCard,PostList}.astro
    │   ├── ui/                      # primitivos propios
    │   └── islands/                 # componentes interactivos (.vue)
    ├── i18n/{ui.ts,es.json,en.json,locales.json}
    ├── lib/{api.ts,seo.ts,content.ts}
    ├── styles/global.css
    └── env.d.ts
```

> Sin `src/content/` (Q-003: blog vía API, no content collections).

## Diferencias con estado actual

| Aspecto | Estado actual | Target |
|---------|---------------|--------|
| Web pública | Nuxt SSG híbrido + Node server | Astro estático puro (Coolify) |
| Build | Dual `.output/public` + `.output/server` | Astro `dist/` estático |
| Runtime landing | Node server para rutas `prerender:false` | Ninguno (Coolify estático) |
| i18n | Hook runtime fetchea backend en startup | Build-time fetch backend (Modo B) |
| JS payload landing | Arrastra auth store, TanStack, i18n hook | 0 KB por defecto |
| Deploy | Un Node server | Coolify (Astro estático) + Coolify (Nuxt) + Coolify (NestJS) |
| Boundaries | Nuxt layers sin aislamiento real | Apps separadas, independientes |
| Fallos | Bug admin puede afectar landing | Aislamiento total |

## Decisiones con trade-offs

### Decisión: Astro + Vue islands para web pública

**Decisión tomada**: web pública migra a Astro con islands en Vue 3.

**Razones**: contenido estático óptimo (CDN, 0 JS por defecto, SEO), performance superior a Nuxt SSG híbrido para contenido, equipo ya conoce Vue (consistencia mental con admin).

**Alternativas descartadas**:
- *Mantener Nuxt SSG para todo*: descartado porque arrastra Node server runtime y payload de auth/i18n en landing.
- *Astro + React islands*: descartado por stack distinto al admin.
- *Astro + Preact*: más liviano pero contexto distinto, pérdida de consistencia.

**Trade-off**: doble codebase frontend (Astro + Nuxt). Se sacrifica simplicidad de un solo repo SPA; se gana aislamiento de fallos, performance y tools óptimas por naturaleza.

### Decisión: `packages/ui/` solo tokens, no componentes

**Decisión tomada**: package compartido contiene únicamente design tokens, Tailwind preset y DaisyUI theme. Sin componentes Vue/Astro.

**Razones**: componentes tienen contextos distintos (Astro `.astro` estático vs Vue reactividad). Compartirlos acopla las dos apps a un mismo componente que debe soportar ambos runtimes.

**Alternativas descartadas**:
- *Compartir componentes Vue*: acoplamiento, el componente debe funcionar en ambos runtimes.
- *Sin package compartido*: drift visual garantizado.

**Trade-off**: se sacrifica DRY de componentes; se gana desacoplamiento. Cada app construye sus componentes consumiendo el preset.

### Decisión: islands en Vue 3 (no Preact/React)

**Decisión tomada**: islands interactivos en Astro usan Vue 3.

**Razones**: consistencia con Nuxt admin (mismo lenguaje, posible share de lógica pura: cálculos pricing, validaciones).

**Alternativas descartadas**: Preact (liviano, pero contexto distinto), React (stack distinto, duplica conocimiento).

**Trade-off**: bundles islands más pesados que Preact; se gana consistencia de stack.

## Principios arquitecturales

1. **Contenido vs app**: tools distintas para naturalezas distintas.
2. **Static-first**: Astro sirve HTML, islas solo donde hace falta.
3. **Aislamiento de fallos**: bug en admin no tira landing, pico en landing no carga admin.
4. **Compartido solo lo irreducible**: tokens en `packages/ui/`, no lógica.
5. **Sin big-bang**: migración incremental por fases (ver `06-migration-phases.md`).