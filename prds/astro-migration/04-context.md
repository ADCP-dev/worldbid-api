---
doc: astro-migration/04-context
title: "Contexto del Proyecto"
status: draft
created: 2026-07-07
---

# Contexto del Proyecto

## Stack actual (verificado)

### Backend (`apps/back/`)
- NestJS + TypeORM + PostgreSQL + Bull (queues) + Nodemailer.
- Auth: JWT + refresh + RBAC.
- Extensiones auto-discovered (`extension.module.ts`): cms, crm, affiliate, content-pipeline, autonomous-agent, stripe, upload-post.

### Frontend (`apps/front/`)
- Nuxt 3 + Vue 3 + DaisyUI + Tailwind CSS + Pinia + TanStack Query + Nuxt Layers.
- 226 archivos `.vue` (verificado).
- 11 `extends` en `nuxt.config.ts`: `modules/landing`, `modules/base`, `extensions/cms`, `extensions/analytics`, `extensions/upload-post`, `extensions/crm`, `extensions/affiliate`, `extensions/content-pipeline`, `extensions/autonomous-agent`, `extensions/stripe`, `extensions/tokens`.
- Auth client-side: Pinia store + `localStorage` + JWT + refreshToken, plugin `auth.client.ts`, middlewares que skip server.
- i18n: `@nuxtjs/i18n` v10.2.3, strategy `prefix_except_default`, defaultLocale `es`, lazy loading, hook `i18n:registerModule` fetchea `/api/v1/translations/langs` en startup runtime.
- Build dual: `.output/public` + `.output/server`, rutas con `prerender:false` obligan Node server runtime.

### Monorepo
- Turborepo + pnpm workspaces.
- Path aliases backend: `@iam/*`, `@users/*`, `@storage/*`, `@infra/*`, `@src/*`, `@ext/*`.
- Path aliases frontend: `@` (apps/front/), `@base`, `@cms`, `@landing`, etc.

## Stack propuesto (`apps/web/`)

| Capa | Tech |
|------|------|
| Framework | Astro (última estable) |
| CSS | Tailwind 4 + DaisyUI 5 |
| Islands | Vue 3 (consistencia con Nuxt admin) |
| Content | Fetch API NestJS en build time (blog + pages) — Q-003 |
| i18n | `astro:i18n` nativo + build-time fetch backend (Modo B) — Q-005 |
| SEO | `@astrojs/sitemap`, `@astrojs/rss`, `astro-seo`, JSON-LD, OG images |
| Deploy | Coolify (self-hosted PaaS, Docker + Nginx) — Q-001 |
| Design tokens | `@foundation/ui` (workspace package, build con `tsup`) — Q-007 |
| Dark mode | Sin dark mode — Q-014 |

### Dependencias esperadas `apps/web/`

- `astro`
- `@astrojs/tailwind`, `@astrojs/vue`, `@astrojs/sitemap`, `@astrojs/rss`
- `astro-seo`
- `vue` (peer para islands)
- `@foundation/ui` (workspace — tokens)
- `tailwindcss` v4, `daisyui` v5

## Convenciones del proyecto (aplican a todo el monorepo)

- **Conventional commits** (`feat:`, `fix:`, `docs:`).
- **Aliases absolutos**: `@iam/*`, `@users/*`, `@/`, `@base/*`, `@cms/*` — nunca rutas relativas largas (`../../../`).
- **`import type`** para tipos-only.
- **NUNCA `any`**: usar `unknown` + type guards.
- **Logger NestJS** (`@nestjs/common` Logger) — no `console.log` en backend.
- **Migraciones vía TypeORM CLI** (`pnpm migration:generate` + `pnpm migration:run`) — nunca SQL hardcode.
- **Tablas extensión**: prefijo `ext_<name>_*` para evitar colisiones.
- **Generadores Hygen** para backend CRUD (`pnpm generate:resource`, `pnpm add:property`) — nunca escribir entity/service/controller a mano.

## Dependencias relevantes

| Dependencia | Dónde | Rol |
|-------------|-------|-----|
| `extensions/cms/` | `apps/back/` | Sirve blog posts y pages vía API. Astro consume en build time. Endpoints `/public` verificados (Q-008). |
| `extensions/stripe/` | `apps/back/` | Billing. Ecommerce futuro reutiliza (Q-012 resuelto). |
| `extensions/translations/` | `apps/back/` | Strings UI + locales. Astro fetchea en build time (Modo B — Q-005). |
| `@nuxtjs/i18n` v10.2.3 | `apps/front/` | i18n actual Nuxt. Astro reemplaza con `astro:i18n` nativo. |
| TanStack Query | `apps/front/` | Cache admin. No se migra a Astro. |

## Constraints — three-tier boundaries

### ✅ Always (no requiere confirmación)

- Usar aliases absolutos (`@iam/*`, `@/`, `@base/*`, etc.).
- Conventional commits.
- Migraciones via TypeORM CLI (no hardcode SQL).
- Generadores Hygen para backend CRUD (`pnpm generate:resource`, `pnpm add:property`).
- `import type` para tipos-only.
- Skill `backend` para todo trabajo en `apps/back/`.
- Skill `frontend` para todo trabajo en `apps/front/`.
- Frontmatter YAML en cada archivo PRD/doc con `id`, `type`, `parent`, `dependencies`.

### ⚠️ Ask first (preguntar antes)

- Instalar nuevas dependencias npm (puede romper versiones compatibles).
- Modificar `nuxt.config.ts` `routeRules` o `extends`.
- Cambiar estructura de `packages/ui` (afecta ambas apps).
- Migrar auth de `localStorage` a httpOnly cookies (ver R1 — recomendado, no bloqueante).
- Cambiar `astro.config.mjs` integraciones.
- Modificar `app.module.ts` (extensions usan auto-discovery — no tocar salvo razón clara).
- Eliminar archivos de `modules/landing/` antes de Fase 4 (rompe Nuxt actual).

### 🚫 Never (prohibido)

- Commitear secrets (`.env`, API keys, JWT_SECRET).
- Modificar `app.module.ts` sin razón arquitectural clara (extensions son auto-discovered).
- Hardcode SQL en migraciones — siempre TypeORM CLI.
- Escribir entity/service/controller/DTO a mano — usar generadores Hygen.
- `git checkout` / `git switch` entre ramas (worktree confinado a su branch).
- `git reset --hard`, `git push --force` sin autorización explícita.
- Build tras cambios (salvo que usuario pida explícito).
- Asumir respuesta del usuario sin verificar — preguntar y esperar.
- Escribir componentes Vue a mano cuando existe uno base en `@base/ui-app/`.
- Crear `FormInput.vue` custom si ya existe en `@base/ui-app/components/form/`.
- **Dark mode**: sin variantes dark en `packages/ui` tokens (Q-014 resuelto).
- **Content collections para blog**: CMS es fuente única, blog vía API NestJS (Q-003 resuelto).

## Supuestos asumidos

- **Asumido**: el equipo tiene capacidad para mantener 2 apps frontend (Astro + Nuxt). *Porque* el PRD propone fases incrementales y la migración es de web pública (chica) no de todo el sistema.
- **Asumido**: NestJS no requiere cambios mayores para servir a Astro. *Porque* solo necesita CORS + endpoints lectura públicos ya verificados (Q-008).
- **Asumado**: Coolify ya tiene deploy hooks listos para rebuild. *Porque* Coolify lo soporta nativamente (Q-009 resuelto).
- **Asumido**: las mismas URLs públicas se mantienen. *Porque* el PRD exige NFR-004 (URLs consistentes para preservar SEO).
- **Asumido**: auth pages se quedan en Nuxt. *Porque* son forms interactivos con auth client-side; Astro no maneja auth estática (Q-011 resuelto).
- **Asumido**: Vue 3 para islands. *Porque* consistencia con admin Nuxt (Q-006 resuelto).
- **Asumido**: build acoplado a backend en build time (Modo B i18n + blog vía API). *Porque* CMS es fuente única de verdad (Q-003, Q-005 resueltos). Fallback estático si backend cae (NFR-007).

## Limitaciones conocidas del stack propuesto

- **Front ↔ Back no linkeados automáticamente**: `fetch` desde Astro a endpoints NestJS no genera edges en el knowledge graph (limitación de graphify).
- **Nuxt auto-imports**: componentes/composables auto-importados del admin no se reflejan en el grafo. No afecta a Astro.
- **`astro:i18n` menos maduro que `@nuxtjs/i18n`**: menos features. Mitigado con build-time fetch backend (Q-005 resuelto, Modo B).
- **Astro no tiene ISR nativo**: on-demand rebuild vía deploy hook Coolify (Q-009 resuelto).
- **Build acoplado a backend**: blog + i18n via API en build time. Fallback estático es/en si backend cae (NFR-007).