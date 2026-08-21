---
doc: astro-public/04-context
title: "Contexto"
status: draft
created: 2026-08-20
---

# Contexto

## Stack actual (verificado)

### Backend (`apps/back/`)
- NestJS + TypeORM + PostgreSQL + Bull (queues) + Nodemailer.
- Auth: JWT + refresh + RBAC. Endpoints públicos sin guard; admin con `@AdminAuth()`.
- Rate limit global: 1000 req/min per user/IP. Contacto necesita override `@Throttle(5, 60_000)`.
- Extensiones auto-discovered (`extension.module.ts`): cms, crm, affiliate, content-pipeline, autonomous-agent, stripe, upload-post. **NUEVA**: `web` (contacto, sin tablas DB).
- Módulo `modules/translations/` (NOT extensión): modelo híbrido estático (UI strings, `entityName=null`) + dinámico (CMS content, `entityName='BlogPost'|'Page'|'Category'|'Tag'`). Fallback 'en', controllers hardcodean default 'es'. Language switching via `?lang=` (primario) o header `x-custom-lang` (`APP_HEADER_LANGUAGE`) (alternativo).
- Config `app.notificationEmail` ya existe en `app-config.type.ts` (reutilizado por contacto).

### Frontend (`apps/front/`)
- Nuxt 3 + Vue 3 + DaisyUI + Tailwind CSS + Pinia + TanStack Query + Nuxt Layers.
- Auth client-side: Pinia store + `localStorage` + JWT + refreshToken.
- i18n: `@nuxtjs/i18n`, strategy `prefix_except_default`, defaultLocale `es`, lazy loading, hook `i18n:registerModule` fetchea `/api/v1/translations/langs` en startup runtime.
- Build dual: `.output/public` + `.output/server`, rutas con `prerender:false` obligan Node server runtime.
- **Sin cambios** en este PRD (la limpieza es out-of-scope).

### Monorepo
- Turborepo + pnpm workspaces. `pnpm-workspace.yaml`: globs `apps/*` + `packages/*` — agregar `apps/web/` NO requiere cambio en workspace.
- `turbo.json`: Turborepo detecta scripts desde `package.json` de cada workspace. Agregar scripts a `apps/web/package.json` los hace disponibles.
- Path aliases backend: `@iam/*`, `@users/*`, `@storage/*`, `@infra/*`, `@src/*`, `@ext/*`.
- Path aliases frontend: `@` (apps/front/), `@base`, `@cms`, `@landing`, etc.

## Stack propuesto (`apps/web/`)

| Capa | Tech | Versión |
|------|------|---------|
| Framework | Astro | **7** (release June 22 2026). Pin a `^7.x`. NO "Astro 5", NO "última estable". |
| Node mínimo | Node | **22.12.0** (Node 20 EOL April 2026 — no usar Node 18 ni 20). |
| Compiler | Rust (no Go) | Built-in Astro 7. |
| Markdown pipeline | Sätteri (no remark/rehype por defecto) | Si se usa markdown, instalar `@astrojs/markdown-remark` para mantener pipeline unified. |
| CSS | Tailwind | 4 |
| UI components | DaisyUI | 5 |
| Islands | Vue 3 | (consistencia con Nuxt admin) |
| Content | Fetch API NestJS en build/render time (blog + pages) | — |
| i18n | `astro:i18n` nativo + build-time fetch `/translations/*` con `?lang=` siempre | — |
| SEO | `@astrojs/sitemap`, `@astrojs/rss`, `astro-seo`, JSON-LD, OG images | — |
| ISR DIY | Astro 7 `Astro.cache` API + `routeRules` (ambos STABLE en v7, experimentales en v6) | nativo |
| Adapter SSR | `@astrojs/node` (mode: standalone) | — |
| Deploy | Coolify (self-hosted PaaS, Docker + Nginx) | — |
| Dark mode | Sin dark mode | — |

> Astro adquirido por Cloudflare en enero 2026 (informativo — el deploy sigue en Coolify self-hosted, sin acción arquitectural).

### Dependencias esperadas `apps/web/`

```json
{
  "dependencies": {
    "astro": "^7.x",
    "@astrojs/node": "^7.x",
    "@astrojs/tailwind": "latest",
    "@astrojs/vue": "latest",
    "@astrojs/sitemap": "latest",
    "@astrojs/rss": "latest",
    "astro-seo": "latest",
    "vue": "^3.x",
    "tailwindcss": "^4.x",
    "daisyui": "^5.x",
    "zod": "latest"
  }
}
```

> Sin `@foundation/ui` (packages/ui fuera de scope). Cada app maneja sus tokens.

## Endpoints públicos verificados (autoritativos)

Todos bajo `/api/v1/`, sin auth. Astro consume en build/render time con `?lang=` siempre.

| Recurso | Endpoint | Query params |
|---|---|---|
| Posts list | GET /api/v1/cms/blog/posts/public | ?lang&search&tagSlugs&categoryId&page&limit |
| Post by slug | GET /api/v1/cms/blog/posts/public/:slug | ?lang (translated-slug aware, fallback base slug) |
| Related posts | GET /api/v1/cms/blog/posts/public/:slug/related | ?limit=3 |
| Posts by category | GET /api/v1/cms/blog/posts/public/category/:categoryId | ?page&limit&lang |
| Categories tree | GET /api/v1/cms/blog/categories/public | ?lang |
| Category by slug | GET /api/v1/cms/blog/categories/public/by-slug/:slug | ?lang |
| Tags with counts | GET /api/v1/cms/blog/tags/public | ?lang |
| Pages list | GET /api/v1/cms/pages/public | ?lang&page&limit |
| Page by slug | GET /api/v1/cms/pages/public/:slug | ?lang |
| SEO metadata | GET /api/v1/cms/seo/:entityName/:entityId | ?lang |
| SEO for page | GET /api/v1/cms/seo/:pageId | ?lang |
| JSON-LD templates | GET /api/v1/cms/seo/template/:type | — |
| Languages | GET /api/v1/translations/langs | — |
| UI strings | GET /api/v1/translations/exact-by-path | ?app&dotPath |
| Contacto (NEW) | POST /api/v1/contact | body: { name, email, message, lang? } |
| ISR webhook (NEW, Astro-side) | POST /api/revalidate (Astro) | body: { event, payload, timestamp } + header X-Revalidate-Signature |

**Envelope paginación**: `{ data: [...], meta: { page, limit, total, totalPages } }`

**Nota sobre `/posts/public`**: el endpoint hace el join server-side de las traducciones polimórficas (tabla `translation`, `entityName='BlogPost' + entityId`) via `loadTranslationsForPosts()` + `attachTranslations()` y adjunta `translations: { [langCode]: { [key]: content } }` a cada post. Astro hace UN call por lista/detalle, sin call separado de traducciones.

## Convenciones del proyecto (aplican a todo el monorepo)

- **Conventional commits** (`feat:`, `fix:`, `docs:`).
- **Aliases absolutos**: `@iam/*`, `@users/*`, `@/`, `@base/*`, `@cms/*` — nunca rutas relativas largas (`../../../`).
- **`import type`** para tipos-only.
- **NUNCA `any`**: usar `unknown` + type guards.
- **Logger NestJS** (`@nestjs/common` Logger) — no `console.log` en backend.
- **Migraciones vía TypeORM CLI** (`pnpm migration:generate` + `pnpm migration:run`) — nunca SQL hardcode.
- **Tablas extensión**: prefijo `ext_<name>_*` para evitar colisiones. La extensión `web` NO tiene tablas (contacto sin persistencia — FR-031), pero si se añaden futuras (newsletter, Q-019), usarían `ext_web_*`.
- **Generadores Hygen** para backend CRUD/extensions (`pnpm generate:extension`, `pnpm generate:resource`, `pnpm add:property`) — nunca escribir entity/service/controller/DTO a mano.

## Dependencias relevantes

| Dependencia | Dónde | Rol |
|-------------|-------|-----|
| `extensions/cms/` | `apps/back/src/extensions/cms/` | Sirve blog posts, pages, categories, tags, SEO vía endpoints `/public`. Astro consume en build/render time. Tablas `ext_cms_*`. Dispara webhook ISR al publicar/editar/despublicar (FR-042). |
| `modules/translations/` | `apps/back/src/modules/translations/` (NOT extensión) | Strings UI (`/exact-by-path`) + locales (`/langs`). Astro fetchea en build time con `?lang=`. |
| `extensions/web/` (NEW) | `apps/back/src/extensions/web/` | Endpoint contacto `POST /api/v1/contact` + `MailService.contactFormNotification()` + Maizzle `contact-notification.hbs`. **SIN tablas DB** (FR-031). |
| MailService | `apps/back/` (módulo email) | Método nuevo `contactFormNotification(name, email, message, lang?)`. |
| `app.notificationEmail` | `app-config.type.ts` | Email destino notificación contacto (ya existe). |
| @nuxtjs/i18n | `apps/front/` | i18n actual Nuxt. Astro reemplaza con `astro:i18n` + build-time fetch. |
| TanStack Query | `apps/front/` | Cache admin. No se migra a Astro. |
| @astrojs/sitemap | `apps/web/` (NEW) | Genera sitemap. Reemplaza endpoints backend `/api/v1/sitemap/*`. |
| @astrojs/node | `apps/web/` (NEW) | Adapter SSR para Coolify (proceso Node standalone, puerto 4321). |
| Astro 7 `Astro.cache` + `routeRules` | `apps/web/` | ISR DIY: cache declarativo por ruta + purge por tag on-demand. |

## Constraints — three-tier boundaries

### ✅ Always (no requiere confirmación)

- Usar aliases absolutos (`@iam/*`, `@/`, `@base/*`, etc.).
- Conventional commits.
- Migraciones via TypeORM CLI (no hardcode SQL).
- Generadores Hygen para backend (`pnpm generate:extension`, `pnpm generate:resource`, `pnpm add:property`).
- `import type` para tipos-only.
- `?lang=` siempre (mecanismo primario) en toda llamada a API NestJS. `x-custom-lang` header solo si query params no son ideales (alternativo).
- Frontmatter YAML en cada archivo PRD/doc con `id`, `type`, `parent`, `dependencies`.
- Tablas extensión con prefijo `ext_<name>_*` (CMS: `ext_cms_*`; web: sin tablas hoy, `ext_web_*` si se añaden futuras).

### ⚠️ Ask first (preguntar antes)

- Instalar nuevas dependencias npm (puede romper versiones compatibles).
- Modificar `nuxt.config.ts` `routeRules` o `extends`.
- Cambiar `astro.config.mjs` integraciones o `routeRules`.
- Modificar `app.module.ts` (extensions usan auto-discovery — no tocar salvo razón clara).
- Eliminar endpoints `/api/v1/sitemap/*` del backend (afecta a Nuxt si aún los consume — coordinar, ejecutar grep check primero — ver `06-migration-phases.md` Fase 2).
- Cambiar `REVALIDATE_SECRET` (requiere update simultáneo en NestJS + Astro).
- Añadir captcha al formulario de contacto (Q-018).

### 🚫 Never (prohibido)

- Commitear secrets (`.env`, API keys, JWT_SECRET, REVALIDATE_SECRET).
- Modificar `app.module.ts` sin razón arquitectural clara (extensions son auto-discovered — la nueva `web` tampoco lo toca).
- Hardcode SQL en migraciones — siempre TypeORM CLI.
- Escribir entity/service/controller/DTO a mano — usar generadores Hygen.
- `git checkout` / `git switch` entre ramas (worktree confinado a su branch).
- `git reset --hard`, `git push --force` sin autorización explícita.
- Build tras cambios (salvo que usuario pida explícito).
- Asumir respuesta del usuario sin verificar — preguntar y esperar.
- Escribir componentes Vue a mano cuando existe uno base en `@base/ui-app/` (aplica a Nuxt admin, no a Astro).
- **Dark mode**: sin variantes dark en tokens.
- **Content collections para blog**: CMS es fuente única, blog vía API NestJS (Q-003 resuelto).
- **Rutas relativas largas** (`../../../`) — siempre alias.
- **`console.log` en backend** — usar NestJS Logger.
- **Persistir mensajes de contacto** — FR-031: sin DB, solo email (no crear tabla `ext_web_contact_message`, no crear migración).

## Supuestos asumidos

- **Asumido**: el equipo tiene capacidad para mantener 2 apps frontend (Astro + Nuxt). *Porque* la migración es incremental y la web pública es chica comparada con el admin.
- **Asumido**: NestJS no requiere cambios mayores para servir a Astro. Solo CORS via `FRONTEND_DOMAINS` + nueva extensión `web` + eliminación de endpoints sitemap + nuevo disparo de webhook ISR.
- **Asumido**: Coolify soporta Astro SSR via Docker (adapter `@astrojs/node`, "Is it a static site?" unchecked, start command `node ./dist/server/entry.mjs`, port 4321). **VERIFICADO** — guía https://antonioleiva.com/astro-ssr-coolify. No hay supuesto pendiente aquí.
- **Asumido**: las mismas URLs públicas se mantienen (NFR-004).
- **Asumido**: auth pages se quedan en Nuxt (Q-011 resuelto). Astro no maneja auth.
- **Asumido**: Vue 3 para islands (Q-006 resuelto).
- **Asumido**: `app.notificationEmail` ya existe en config backend y es accesible desde MailService.
- **Asumido**: MailService soporta añadir un método nuevo sin romper los existentes.
- **Asumido**: Maizzle está configurado en el backend y puede renderizar `contact-notification.hbs` (Q-020 confirma ubicación al inicio de Fase 1, no bloqueante).
- **Asumido**: el cache en memoria del proceso Node es suficiente para 1 container Coolify (R-COOLIFY-1). Si el container restartea, el cache se regenera en la próxima request (cold start aceptable).
- **Asumido**: `Astro.cache` + `routeRules` son STABLE en Astro 7 (eran experimentales en v6) — release notes June 22 2026 confirman.

## Limitaciones conocidas del stack propuesto

- **Front ↔ Back no linkeados automáticamente**: `fetch` desde Astro a endpoints NestJS no genera edges en el knowledge graph (limitación de graphify).
- **Nuxt auto-imports**: componentes/composables auto-importados del admin no se reflejan en el grafo. No afecta a Astro.
- **`astro:i18n` menos maduro que `@nuxtjs/i18n`**: menos features. Mitigado con build-time fetch backend (Q-005 resuelto, Modo B) + `?lang=` siempre.
- **Cache no persiste si container restartea**: el cache vive en memoria del proceso Node (Coolify container). Si restartea, se regenera en la próxima request (cold start). Aceptable para 1 container (R-COOLIFY-1, baja severidad). No hay Redis ni cache distribuido (overkill para este proyecto).
- **Build acoplado a backend**: blog + i18n via API en build/render time. Fallback estático es/en si backend cae (NFR-007).
- **Traducciones polimórficas**: la tabla `translation` usa `entityName`+`entityId` polimórfico, que es complejo de queryar, pero el endpoint `/posts/public` lo resuelve server-side. Astro no ve esa complejidad (R-TRANSLATION-1).
- **Markdown pipeline Sätteri**: si se usa markdown (no es el caso default — blog vía API), instalar `@astrojs/markdown-remark` para mantener el pipeline unified (remark/rehype). Para este PRD, no se usa markdown en repo (blog vía API NestJS).