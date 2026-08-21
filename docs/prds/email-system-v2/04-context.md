---
doc: email-system-v2/04-context
title: "Contexto"
status: draft
created: 2026-08-20
---

# Contexto

## Stack actual (verificado)

### Backend email — 2 pipelines (`apps/back/`)

**Pipeline 1 — Core MailService** (`apps/back/src/modules/communications/mail/`):

| Componente | Tech / versión | Detalle |
|------------|----------------|---------|
| Build-time | Maizzle v5.5.0 (declarado `^5.0.8`) | `mail-templates/emails/*.hbs` → `build/*.hbs` via `pnpm maizzle:build` |
| Runtime | Handlebars 4.7.8 | `{{vars}}` preservados post-Maizzle, interpolados en runtime |
| Layout | `mail-templates/layouts/main.hbs` (`<yield />`) | Compartido por los 4 templates core |
| Transport | Nodemailer 6.10.1 SMTP | Queue BullMQ opcional via `WORKER_HOST` env |
| Queue | `@nestjs/bullmq` ^11.0.4, `bullmq` ^5.68.0 | `QueuedMailerService` + `EmailProcessor` |
| i18n | `nestjs-i18n` 10.5.1 | Por método (no por template) |
| Tailwind | `tailwindcss` 3.4.17 (dev) + `tailwindcss-preset-email` ^1.4.0 | Config en `tailwind.email.config.js` |
| PostHTML | (Maizzle v5) | Tags `<x-main>`, `<yield />`, `<if>`, `<each>`, `<fetch>` |
| `build/` en git | AUSENTE | No commiteado, no en `.gitignore` — bug crítico |
| Cache | NINGUNO | Cada email re-lee + re-compila desde disco |
| Métodos | 4 | `userSignUp` (activation.hbs), `forgotPassword` (reset-password.hbs), `confirmNewEmail` (confirm-new-email.hbs), `invoicePaymentConfirmed` (HTML inline — tech debt) |
| `from` | `mail.defaultName <mail.defaultEmail>` | |
| Context | `{ app_name, app_url, subject, greeting, body_text, button_text, link, title }` | |

**Pipeline 2 — Spec-engine NotificationDispatcher** (`apps/back/src/core/spec-engine/`):

| Componente | Tech / versión | Detalle |
|------------|----------------|---------|
| Build-time | NINGUNO (sin Maizzle) | Templates raw HTML, inline styles |
| Runtime | Handlebars 4.7.8 | `extensions/<name>/templates/*.hbs` |
| Layout | NINGUNO (no shared layout) | Cada template es standalone HTML |
| Transport | Nodemailer 6.10.1 SMTP | Sin queue (sync) |
| i18n | NINGUNO | Templates hardcode Spanish |
| Cache | `Map<string, CachedTemplate>` (`notification-dispatcher.ts:109`) | Propio del dispatcher |
| Usado por | extensions: tasks, affiliate, upload-post | |
| `from` | `app.notificationEmail` raw (no display name) | |
| Context | `{ entity, user, app: { url, name, notificationEmail } }` | Divergente del core (`app.url` vs `app_url`, `app.name` vs `app_name`) |

### Renderizado duplicado (ambos pipelines — verificado)

| Ubicación | Líneas | Qué hace |
|-----------|--------|----------|
| `apps/back/src/infrastructure/mailer/mailer.service.ts` | `fs.readFile` + `Handlebars.compile` | Render core |
| `apps/back/src/modules/communications/email-queue/email.processor.ts` | 77-78 | `fs.readFile` + `Handlebars.compile` (duplicado) |
| `apps/back/src/core/spec-engine/notification-dispatcher.ts` | 109 (cache), 425-467 (`renderTemplate`), 437 (`fs.readFile`), 447 (`Handlebars.compile`) | `renderTemplate()` con su propio cache `Map` |

> **Nota**: el path real del EmailProcessor es `apps/back/src/modules/communications/email-queue/email.processor.ts` (sin el `mail/` extra que citaba el v1 de este PRD). Verificado con `find` y `grep`.

### Patrones de extensión (3 inconsistentes — verificado)

| Patrón | Extensión | Cómo |
|--------|-----------|------|
| **(A) Core MailService** | stripe | `import { MailService }` (`stripe.service.ts:8,24`), usa `invoicePaymentConfirmed` (HTML inline, `mail.service.ts:189`); fallback `stripe.service.ts:601` "MailService not available" |
| **(B) Dispatcher + .hbs propias** | tasks | `task-assigned.hbs`, `stale-tasks.hbs` via `NotificationDispatcher` |
| **(C) HTML inline strings** | affiliate, upload-post | Ignoran templates, construyen HTML string en código |

### Build pipeline (roto — verificado)

- `maizzle:build` script = `maizzle build && node ./scripts/flatten-maizzle-output.js` (verificado en `apps/back/package.json`)
- `flatten-maizzle-output.js` aplana `build/src/.../emails/*.hbs` (anidado en v5) → `build/*.hbs`
- `build/` no en git, no en `.gitignore` — simplemente ausente
- No hay prebuild/predev hook que corra `maizzle:build`
- `maizzle:serve` previsualiza pero no escribe a `build/`
- Dos configs Tailwind: `tailwind.config.js` (general) + `tailwind.email.config.js` (el que Maizzle usa)

### Frontend (verificado — v1 PRD estaba EQUIVOCADO sobre Tailwind 3)

> **FIX crítico**: el v1 de este PRD decía "frontend usa Tailwind 3". **Eso es FALSO.** Verificado en `apps/front/package.json`:

```json
{
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.3",
    "tailwindcss": "^4.1.3",
    "@tailwindcss/typography": "^0.5.16",
    "daisyui": "^5.5.19"
  }
}
```

El frontend usa **Tailwind 4.1.3 + DaisyUI 5.5.19** (NO Tailwind 3). `@maizzle/tailwindcss` es también Tailwind 4. Coexisten naturalmente en workspaces separados (`packages/emails/` para emails, `apps/front/` para frontend). **No hay conflicto** (Q-003 RESUELTA, R-MAIZ-1 ELIMINADO del v1).

### Config keys (env vars y config type)

| Key | Dónde | Rol |
|-----|-------|-----|
| `mail.defaultName` | `mail-config.type.ts` | Nombre display del `from` (unificado en ambos pipelines) |
| `mail.defaultEmail` | `mail-config.type.ts` | Email del `from` (unificado en ambos pipelines) |
| `app.notificationEmail` | `app-config.type.ts` | `from` del spec-engine (raw) → **target: recipient-only** (FR-033) |
| `app.url` | `app-config.type.ts` | URL base del frontend (usado en context como `app_url` en core, `app.url` en spec-engine) → **target: `appUrl` prop** (FR-031) |
| `app.name` | `app-config.type.ts` | Nombre de la app (usado en context como `app_name` en core, `app.name` en spec-engine) → **target: `appName` prop** (FR-031) |
| `WORKER_HOST` | env | Si set, la queue BullMQ se activa; si no, envío sync |

### Dependencias (versiones verificadas)

| Dependencia | Versión instalada | Rol | Target |
|-------------|-------------------|-----|--------|
| `@maizzle/framework` | 5.5.0 (declarado `^5.0.8`) | Build-time email templates | `^6.x` en `packages/emails/` (FR-070) — `apps/back/` no la declara directa |
| `handlebars` | 4.7.8 | Runtime template interpolation (ambos pipelines) | **ELIMINADA** (FR-001, NFR-003) |
| `nodemailer` | 6.10.1 | SMTP transport | Sin cambios |
| `@nestjs/bullmq` | ^11.0.4 | Queue integration | Sin cambios |
| `bullmq` | ^5.68.0 | Queue lib | Sin cambios |
| `nestjs-i18n` | 10.5.1 | i18n core (no spec-engine) | Sin cambios — se expone a extensiones via `buildEmailProps()` |
| `tailwindcss` (back dev) | 3.4.17 | Tailwind 3 (Maizzle v5) | **ELIMINADA** del back — Tailwind 4 via `@maizzle/tailwindcss` en `packages/emails/` |
| `tailwindcss-preset-email` | ^1.4.0 | Preset email Tailwind (Maizzle v5) | **ELIMINADA** (FR-005) |
| `@maizzle/tailwindcss` | NO instalado | — | `^1.x` en `packages/emails/` (FR-070) — Tailwind 4 |
| `@nestjs-modules/mailer` | NO instalado | — | NO se añade (renderer propio) |
| `tailwindcss` (front) | ^4.1.3 | Frontend Tailwind 4 | Sin cambios — coexiste con `@maizzle/tailwindcss` (NFR-007) |
| `daisyui` (front) | ^5.5.19 | Frontend DaisyUI 5 | Sin cambios |

## Stack propuesto (target)

| Capa | Tech actual | Tech target | Cambio |
|------|-------------|-------------|--------|
| Email rendering | Maizzle v5.5.0 build-time + Handlebars runtime | Maizzle v6 `render()` runtime (Vue SSR + Tailwind inline) | **Elimina build step + Handlebars** |
| Runtime interpolation | Handlebars 4.7.8 (preserva `{{}}` post-Maizzle) | **Eliminada** — datos dinámicos son Vue props via `render(path, { props })` | Elimina Handlebars |
| Config | `maizzle.config.js` (CJS) + `tailwind.email.config.js` | **Eliminadas** — `render()` no requiere config de build; Tailwind 4 via `@theme` en `<style>` | Elimina configs |
| Tailwind | Tailwind 3 + `tailwindcss-preset-email` (back) | Tailwind 4 + `@maizzle/tailwindcss` en `packages/emails/` | Dep swap |
| Renderer | Duplicado (3 lugares) | `TemplateRenderer` unificado (wraps `render()`, cache `path+propsHash`) | Refactor |
| Context/props | Divergente (`app_url` vs `app.url`) | `buildEmailProps()` unificado (`appName`, `appUrl`) | Helper |
| Template location | `extensions/<name>/templates/*.hbs` (con `templates/`) | `extensions/<name>/emails/*.vue` + `modules/<name>/emails/*.vue` + `packages/emails/emails/*.vue` (sin `templates/`) | Auto-discovery |
| Extension isolation | Ninguna (comparten dispatcher Handlebars) | Cada extensión tiene `emails/*.vue` via dispatcher | Nueva estructura |
| Layout sharing | `main.hbs` core-only | `packages/emails/emails/Layout.vue` importado via alias `@emails/Layout.vue` | Compartición |
| `build/` en git | AUSENTE (bug crítico) | **NO existe** — `render()` lee `.vue` on-demand | Elimina el bug |
| i18n extensions | NINGUNO (hardcode Spanish); helper `{{t}}` runtime | Pre-resuelto en `buildEmailProps()` — strings como Vue props | Nueva feature |
| `from` unificado | Core: `mail.default*`; spec-engine: `app.notificationEmail` raw | Ambos: `mail.defaultName <mail.defaultEmail>` | Unificación |
| `invoicePaymentConfirmed` | HTML inline en `MailService`, sync | **ELIMINADO** de `MailService`; `extensions/stripe/emails/invoice.vue` via dispatcher + queue | Debt cleanup |
| Stripe + MailService | `stripe.service.ts:8` importa `MailService` | **Eliminado** — stripe usa dispatcher | Decoupling |

### Dependencias target — `packages/emails/package.json` (NUEVO workspace)

```json
{
  "name": "@foundation/emails",
  "type": "module",
  "private": true,
  "dependencies": {
    "@maizzle/framework": "^6.x",
    "@maizzle/tailwindcss": "^1.x"
  }
}
```

### Dependencias target — `apps/back/package.json` (cambios)

```diff
- "handlebars": "4.7.8",
- "tailwindcss-preset-email": "^1.4.0",
- "tailwindcss": "3.4.17",  // (devDep)
- "@maizzle/framework": "^5.0.8",  // (moves to packages/emails/)
- "maizzle:build": "maizzle build && node ./scripts/flatten-maizzle-output.js",
- "maizzle:serve": "maizzle serve",
```

> `apps/back/` NO declara `@maizzle/framework` directa — la consume via dynamic import desde `packages/emails/` (FR-071). Si el dynamic import directo falla (R-DYNAMIC-1), `packages/emails/` expone una API boundary (Q-009).

### Frontend — sin cambios

`apps/front/` mantiene Tailwind 4.1.3 + DaisyUI 5.5.19. Coexiste con `@maizzle/tailwindcss` (Tailwind 4) en `packages/emails/` — workspaces separados, sin conflicto (NFR-007, Q-003 RESUELTA).

## Monorepo conventions (relevantes a email)

- **Path aliases backend**: `@iam/*`, `@users/*`, `@storage/*`, `@infra/*`, `@src/*`, `@ext/*`, `@comms/*` (verificado en `apps/back/tsconfig.json`). `@comms/mail/mail.service` confirmado via `stripe.service.ts:8`.
- **Aliases aplicables a email**:
  - `@src/modules/communications/mail/*` — core mail module
  - `@src/modules/communications/email-queue/*` — email queue
  - `@ext/<name>/emails/*` — extension emails (nuevo — FR-040)
  - `@emails/*` — packages/emails/emails/* (nuevo alias, Q-010)
  - `@infra/mailer` — `infrastructure/mailer/mailer.service.ts`
- **Workspace**: `pnpm-workspace.yaml` ya incluye `packages/*` — `packages/emails/` se descubre automáticamente (FR-070).
- **Extensiones auto-discovered**: `extension.module.ts` auto-discovered por `ExtensionLoaderModule` (NO se edita `app.module.ts`).
- **Tablas extensión**: prefijo `ext_<name>_*` (no aplica a este PRD — no hay tablas nuevas, solo templates).
- **Generadores Hygen**: NO aplica a templates de email (los templates `.vue` se escriben a mano, son contenido no CRUD).
- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
- **Logger NestJS**: `@nestjs/common` Logger, NO `console.log`.

## Comparación de los 2 sistemas actuales (autoritativo)

| Aspecto | Core MailService | Spec-engine NotificationDispatcher |
|---------|------------------|-----------------------------------|
| **Ubicación** | `apps/back/src/modules/communications/mail/` | `apps/back/src/core/spec-engine/` |
| **Build-time engine** | Maizzle v5.5.0 | NINGUNO |
| **Runtime engine** | Handlebars 4.7.8 | Handlebars 4.7.8 |
| **Templates source** | `mail-templates/emails/*.hbs` | `extensions/<name>/templates/*.hbs` |
| **Templates build** | `mail-templates/build/*.hbs` (CSS inlined, `{{}}` preserved) | N/A (raw HTML, inline styles) |
| **Layout** | `mail-templates/layouts/main.hbs` (`<yield />`) | NINGUNO (standalone HTML) |
| **CSS** | Tailwind 3 + `tailwindcss-preset-email` | Inline styles (no Tailwind) |
| **Cache** | NINGUNO | `Map<string, CachedTemplate>` (`:109`) |
| **i18n** | `nestjs-i18n` por método | NINGUNO (hardcode Spanish) |
| **`from`** | `mail.defaultName <mail.defaultEmail>` | `app.notificationEmail` raw |
| **Context shape** | `{ app_name, app_url, subject, greeting, body_text, button_text, link, title }` | `{ entity, user, app: { url, name, notificationEmail } }` |
| **Divergencia context** | `app_url`, `app_name` | `app.url`, `app.name` |
| **Usado por** | auth (signUp, forgotPassword, confirmNewEmail), stripe (invoice) | extensions: tasks, affiliate, upload-post |
| **Queue** | BullMQ opcional via `WORKER_HOST` | Sync (no queue) |
| **Render paths duplicados** | `MailerService.sendMail()` (`mailer.service.ts`) + `EmailProcessor.process()` (`email.processor.ts:77-78`) | `NotificationDispatcher.renderTemplate()` (`notification-dispatcher.ts:425-467`, cache `:109`) |
| **`invoicePaymentConfirmed`** | HTML inline en `MailService` (`mail.service.ts:189`), sync send | N/A |
| **`build/` en git** | AUSENTE (bug crítico) | N/A (no build) |
| **Patterns extensión** | (A) stripe importa MailService (`stripe.service.ts:8,24,601`) | (B) tasks .hbs propias, (C) affiliate/upload-post inline HTML |

## Constraints — three-tier boundaries

### ✅ Always (no requiere confirmación)

- Usar aliases absolutos (`@src/*`, `@ext/*`, `@infra/*`, `@emails/*` nuevo).
- Conventional commits (`feat:`, `fix:`, `refactor:`).
- `import type` para tipos-only.
- NestJS `Logger` (no `console.log`).
- `TemplateRenderer.render(path, props)` para todo rendering de email (ambos pipelines).
- `buildEmailProps()` para construir props de email (ambos pipelines).
- `from` = `mail.defaultName <mail.defaultEmail>` en ambos pipelines.
- Templates `.vue` en `extensions/*/emails/` + `modules/*/emails/` + `packages/emails/emails/` (sin `templates/` subfolder).
- `Layout.vue` importado via alias `@emails/Layout.vue` (Q-010), no duplicado.
- `app.notificationEmail` es recipient-only (admin alerts), NO `from`.
- i18n pre-resuelto en `buildEmailProps()` — strings como Vue props, NO `{{t}}` en template.
- `pnpm docs:sync` tras cambios en docs.

### ⚠️ Ask first (preguntar antes)

- Instalar nuevas dependencias npm (puede romper versiones compatibles).
- Modificar `app.module.ts` (extensions son auto-discovered — no tocar).
- Cambiar el props shape `EmailProps` (afecta ambos pipelines + todos los templates migrados).
- Cambiar el `from` strategy (afecta todos los emails).
- Añadir un nuevo método a `MailService` (considerar si es core o extensión — preferir dispatcher).
- Migrar una extensión de pattern C a dispatcher (afecta comportamiento existente).
- Cambiar `WORKER_HOST` behavior (afecta sync vs queue).
- Definir el mecanismo de alias `@emails/Layout.vue` (Q-010 — tsconfig path mapping, path absoluto, o relativo).

### 🚫 Never (prohibido)

- Escribir HTML inline en emails (extensiones o `MailService`) — NFR-005, FR-060, FR-062.
- Usar Handlebars — `fs.readFile` directo, `Handlebars.compile`, `import Handlebars`, `{{handlebars}}` runtime — FR-001, FR-003, NFR-003.
- Crear archivos `.hbs` — NFR-004.
- Build step para emails — `maizzle build`, `build/` output, `flatten-maizzle-output.js` — D-03.
- Context/props shape divergente (`app_url` vs `app.url`) — FR-031, usar `buildEmailProps()`.
- Usar `app.notificationEmail` como `from` — FR-033, es recipient-only.
- Hardcode Spanish en templates de extensión — FR-051, usar `buildEmailProps()` con `lang`.
- Helper `{{t "key"}}` en templates `.vue` — FR-050, i18n se pre-resuelve en `buildEmailProps()`.
- `console.log` en backend — usar NestJS Logger.
- Migraciones SQL escritas a mano (no aplica a este PRD — sin tablas, pero principio general).
- Editar `app.module.ts` para añadir extensión — son auto-discovered.
- Rutas relativas largas (`../../../`) — siempre alias.
- Usar `@nestjs-modules/mailer` (no instalado, no se añade — renderer propio).
- Reemplazar Nodemailer o BullMQ (out-of-scope).
- Stripe importar `MailService` — FR-061, stripe usa dispatcher.

## Supuestos asumidos

- **Asumido**: Maizzle v6 `render()` API es estable y utilizable en monorepo pnpm (docs oficiales lo confirman — https://maizzle.com/docs/deploy/nodemailer).
- **Asumido**: `render(path, { props })` retorna `{ html, plaintext }` y compila el SFC con Vue SSR + Tailwind inline on-demand (verificado en docs).
- **Asumido**: Node soporta `dynamic import('@maizzle/framework')` desde CJS (`apps/back/`) hacia ESM (`packages/emails/`). Si falla, `packages/emails/` expone API boundary (Q-009, R-DYNAMIC-1).
- **Asumido**: `nestjs-i18n` 10.5.1 soporta `I18nService.t(key, { lang })` para pre-resolver strings en `buildEmailProps()`.
- **Asumido**: Las keys de config `mail.defaultName`, `mail.defaultEmail`, `app.notificationEmail`, `app.url`, `app.name` existen y son accesibles via `ConfigService`.
- **Asumido**: Las extensiones `tasks`, `affiliate`, `upload-post`, `stripe` pueden ser modificadas sin romper su comportamiento público.
- **Asumido**: El envío via BullMQ opcional (`WORKER_HOST`) sigue funcionando tras el refactor del `EmailProcessor`.
- **Asumido**: Vue props son serializables (strings, numbers, arrays, objects plain). Date objects se convierten a ISO string (Q-012).
- **Asumido (dependencia)**: si el PRD `astro-public` se implementa primero, el template `contact-notification.hbs` escrito en v5 se reescribe en v6 como `contact-notification.vue` durante esta migración (1 template, ~30 líneas, costo aceptable — R-ASTRO-1).

## Limitaciones conocidas del stack propuesto

- **Dynamic import ESM desde CJS** (Q-009, R-DYNAMIC-1): `@maizzle/framework` v6 es ESM-first. NestJS backend es CJS. Resolución: `packages/emails/` workspace ESM-native + dynamic `import()` desde `apps/back/`. Si el dynamic import directo falla, API boundary. Spike en Fase 0.
- **Render performance** (Q-011, R-PERF-1): `render()` runtime tiene costo de CPU en el primer render (compila Vue SFC + Tailwind inline). Issue #430 reportó 18s en Kubernetes con v5. v6 es más rápido pero necesita verificación. Mitigado con cache (`TemplateRenderer` cachea `html` por `path+propsHash`; Maizzle v6 cachea SFC compilado internamente). Benchmark en Fase 0.
- **Vue runtime en backend** (R-VUE-RUNTIME-1): `render()` usa Vue SSR, añade Vue al runtime del backend NestJS. Verificar impacto en bundle size y memory. Spike Fase 0.
- **Cache miss para props únicos** (R-CACHE-1): emails con props únicos (ej: reset-password con hash único por request) siempre cache miss en ese `path+propsHash`. Mitigado: Maizzle v6 cachea el SFC compilado internamente, así que solo la interpolación de props se repite (rápido en v6). Aceptable para emails transaccionales de bajo volumen.
- **Props serialization** (Q-012): Vue props deben ser serializables (strings, numbers, arrays, objects plain). Si hoy se pasan Date objects o instancias como Handlebars context, hay que convertirlos a ISO strings u objetos plain en `buildEmailProps()`. Spike Fase 0.
- **Blast radius renderer unificado** (R-RENDER-1): un bug en `TemplateRenderer` afecta TODOS los emails. Antes, un bug en el core no afectaba al spec-engine y viceversa. Mitigado con tests de renderer (cache hit/miss, props injection, dynamic import).
- **Auto-discovery I/O cost** (D-02 trade-off): escanear `extensions/*/emails/` + `modules/*/emails/` + `packages/emails/emails/` en startup tiene costo de I/O. Mitigado con cache de discovery (scan una vez en startup, refresh lazy bajo demanda).
- **Alias `@emails/Layout.vue`** (Q-010): requiere config de path mapping en `apps/back/tsconfig.json` (o `packages/emails/package.json` exports). Alternativa: path relativo (verboso) o path absoluto (acoplado al filesystem). Decisión en Fase 0.