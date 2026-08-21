---
doc: email-system-v2/01-overview
title: "Overview"
status: draft
created: 2026-08-20
---

# Email System v2 — Overview

## Resumen ejecutivo

El backend Foundation tiene **dos pipelines de email paralelos que no comparten nada**. El pipeline core (`MailService` en `apps/back/src/modules/communications/mail/`) usa Maizzle v5.5.0 build-time + Handlebars runtime, sirve los 4 emails de autenticación y facturación, y arrastra un build roto: `build/` no se commitea a git, fresh checkout no puede enviar emails hasta que alguien corra `pnpm maizzle:build` manualmente. El pipeline spec-engine (`NotificationDispatcher` en `apps/back/src/core/spec-engine/`) usa Handlebars runtime only (sin Maizzle), sirve notificaciones de extensiones (tasks, affiliate, upload-post), tiene su propio cache y su propio context shape — divergente del core.

Los dos pipelines duplican lógica de renderizado (`fs.readFile` + `Handlebars.compile` en `mailer.service.ts`, `email.processor.ts:77-78`, y `notification-dispatcher.ts:425-467`), divergen en context shape (`app_url` vs `app.url`, `app_name` vs `app.name`), divergen en `from` (`mail.defaultName <mail.defaultEmail>` vs `app.notificationEmail` raw), y solo el core tiene i18n (extensiones hardcodean español). Adicionalmente, hay tres patrones inconsistentes en extensiones: stripe importa `MailService` core (`stripe.service.ts:8`), tasks usa templates `.hbs` propias via dispatcher, affiliate/upload-post construyen HTML inline strings. La deuda técnica incluye `invoicePaymentConfirmed` como HTML inline en `MailService` (sync send, sin queue).

**Handlebars como runtime de interpolación es deuda técnica.** El approach v1 de este PRD (Maizzle v6 build-time preservando `{{handlebars}}` para runtime) era arquitecturalmente erróneo: doblaba el trabajo (compilar `.vue` a build-time + interpolar `{{}}` a runtime) y forzaba a commitear `build/`. La verificación de la `render()` API de Maizzle v6 (https://maizzle.com/docs/deploy/nodemailer) confirma que **Maizzle v6 puede compilar `.vue` + Tailwind + inlines CSS en runtime**, pasando los datos dinámicos como **Vue props**. Esto elimina Handlebars, elimina el build step, elimina `build/` del repo, y unifica el renderer en un wrapper fino sobre `render()`.

La migración: Maizzle v6 (`render()` API, Vue SFCs, Tailwind 4 via `@maizzle/tailwindcss`, ESM-first), **eliminación completa de Handlebars**, un renderer unificado `TemplateRenderer` que wraps `render()` con cache por `path + propsHash`, un props shape via `buildEmailProps()`, templates desde cualquier sitio (`extensions/*/emails/` + `modules/*/emails/` + `packages/emails/emails/` con auto-discovery), layout compartido en `packages/emails/`, i18n pre-resuelto como props (no helper en template), y cleanup de deuda técnica (stripe migra a dispatcher con `extensions/stripe/emails/invoice.vue`, `MailService.invoicePaymentConfirmed()` se elimina).

```
            ┌──────────────────────────────────────┐
            │       apps/back/ (NestJS CJS)         │
            │                                      │
            │  TemplateRenderer (wrapper render()) │
            │   cache Map<path+propsHash, html>     │
            │  buildEmailProps() (unified shape)    │
            │         ▲                ▲            │
            │         │                │            │
            │  ┌──────┴──────┐  ┌──────┴──────┐     │
            │  │ MailerService│  │ Notif       │     │
            │  │ (core auth)  │  │ Dispatcher  │     │
            │  └──────┬───────┘  └──────┬──────┘     │
            │         │                 │           │
            │  ┌──────▼─────────────────▼──────┐     │
            │  │  dynamic import('@maizzle/    │     │
            │  │  framework') → render()      │     │
            │  └──────────────┬───────────────┘     │
            └─────────────────┼────────────────────┘
                              │ (runtime, no build step)
            ┌─────────────────▼────────────────────┐
            │  Maizzle v6 render() runtime          │
            │  (ESM, Vite, Vue SSR, Tailwind 4)     │
            │                                       │
            │  packages/emails/emails/*.vue (core)  │
            │  packages/emails/Layout.vue (shared)   │
            │  extensions/<name>/emails/*.vue       │
            │  modules/<name>/emails/*.vue          │
            └───────────────────────────────────────┘
                            │
                    Nodemailer SMTP
                  (+ optional BullMQ queue)
```

> Maizzle v6 `render()` lee el `.vue` del disco, lo compila con Vue SSR + Tailwind inline, y retorna `{ html, plaintext }`. El primer render es más lento (~ms); los subsiguientes cachean el SFC compilado. `TemplateRenderer` añade un cache de `html` por `path + propsHash`. Ver `02-architecture.md`.

## Problema / motivación

### Dos pipelines paralelos que no comparten nada

El sistema actual es fragmentación arquitectural, no separación de concerns. Los dos pipelines hacen esencialmente lo mismo (render HTML + enviar via Nodemailer SMTP) pero con stacks, context, `from`, cache e i18n distintos. Duplican `fs.readFile` + `Handlebars.compile` en `MailerService.sendMail()` (`infrastructure/mailer/mailer.service.ts`), `EmailProcessor.process()` (`modules/communications/email-queue/email.processor.ts:77-78`), y `NotificationDispatcher.renderTemplate()` (`core/spec-engine/notification-dispatcher.ts:425-467`, con su propio cache `Map` en línea 109). Cualquier cambio en uno no se propaga al otro. Bugs de rendering existen en un pipeline pero no en el otro.

### Handlebars como runtime de interpolación es deuda

El approach actual (Maizzle v5 build-time → HTML con `{{handlebars}}` preservados → Handlebars runtime interpola) es **doble trabajo**: compilar el template a build-time Y interpolar variables a runtime. Maizzle v6 con `render()` elimina esa doble pasada: el `.vue` se compila on-demand en runtime y los datos dinámicos entran como Vue props. Handlebars desaparece por completo. No hay `{{handlebars}}` en ningún output. No hay dependencia `handlebars` en `apps/back/package.json`.

### Build roto en checkout limpio (v1 approach)

El output de `pnpm maizzle:build` (`build/*.hbs`) **no se commitea a git**. Un fresh checkout no puede enviar emails de autenticación hasta que alguien recuerde correr `pnpm maizzle:build` manualmente. El v1 de este PRD proponía "commitear build/" como fix. **Esa decisión queda OBSOLETA**: con `render()` runtime no hay `build/` para commitear — los `.vue` son el source y `render()` los lee del disco on-demand. El bug desaparece eliminando el build step.

### Tres patrones inconsistentes en extensiones

| Patrón | Extensiones | Cómo |
|--------|--------------|------|
| **(A) Core MailService** | stripe | `import { MailService }` (`stripe.service.ts:8`), usa `invoicePaymentConfirmed` (HTML inline) |
| **(B) Dispatcher + .hbs propias** | tasks | `task-assigned.hbs`, `stale-tasks.hbs` via `NotificationDispatcher` |
| **(C) HTML inline strings** | affiliate, upload-post | Ignoran templates, construyen HTML string en código |

Cero consistencia. Agregar un nuevo tipo de notificación requiere decidir cuál patrón seguir, y la respuesta no es obvia.

### Context shape divergente

- Core: `{ app_name, app_url, subject, greeting, body_text, button_text, link, title }`
- Spec-engine: `{ entity, user, app: { url, name, notificationEmail } }`

`app_url` vs `app.url`, `app_name` vs `app.name`. Un mismo template no puede compartirse entre pipelines. Un helper que construye contexto para core no sirve para spec-engine y viceversa.

### No cache en core

`MailService` core **no tiene cache de templates**. Cada email re-lee el archivo del disco y re-compila con `Handlebars.compile`. En volumen, esto es I/O + CPU innecesario. El spec-engine sí tiene cache (`Map<path, compiled>` en `notification-dispatcher.ts:109`), pero core no. Asimetría.

### No i18n en extensiones

Templates de extensiones (`task-assigned.hbs`, etc.) **hardcodean español**. No pasan por `nestjs-i18n`. El core sí usa i18n. En un proyecto con i18n es/en, los emails de tasks llegan en español a usuarios english.

### Deuda técnica invoicePaymentConfirmed

`MailService.invoicePaymentConfirmed()` (`mail.service.ts:189`) renderiza HTML **inline en el método**, sin template, sin queue (sync send). Esto es tech debt explícito: cualquier cambio de copy requiere editar el service, no el template. Y no usa la queue BullMQ.

## Objetivos (medibles)

| # | Objetivo | Criterio de éxito |
|---|----------|-------------------|
| O1 | Migrar Maizzle v5.5.0 → v6 (`render()` API, Vue SFCs, Tailwind 4 via `@maizzle/tailwindcss`, ESM) | `02-architecture.md` aprobado, `render()` renderiza un `.vue` desde `apps/back/` via dynamic import |
| O2 | **Eliminar Handlebars completamente** | Cero `handlebars` en `apps/back/package.json` deps; cero `.hbs` files en repo; cero `Handlebars.compile` en `mailer.service.ts`/`email.processor.ts`/`notification-dispatcher.ts` |
| O3 | **Renderer runtime con `render()` de Maizzle v6** | `TemplateRenderer` wraps `render()` con cache por `path + propsHash`; `render() < 500ms` primera render, `< 5ms` cache hit |
| O4 | Unificar renderer: un `TemplateRenderer` con cache, usado por `MailerService` y `NotificationDispatcher` | Cero `fs.readFile` directo en `MailerService`/`EmailProcessor` (grep check); cero `Handlebars.compile` en todo `apps/back/src/` |
| O5 | Unificar props shape: un `buildEmailProps()` helper | Cero referencia a `app_url` divergente — un único shape de Vue props |
| O6 | **Templates desde cualquier sitio** (extensiones Y módulos) con auto-discovery | Renderer escanea `extensions/*/emails/` + `modules/*/emails/` + `packages/emails/emails/`; drop folder → funciona |
| O7 | i18n para extensiones (pre-resuelto como props, no helper en template) | Email de task en `lang=en` renderiza en inglés — strings pasados como props |
| O8 | Unificar `from` en `mail.defaultName <mail.defaultEmail>` en ambos pipelines | Spec-engine ya no usa `app.notificationEmail` raw como `from` (pasa a recipient-only) |
| O9 | Cleanup deuda: `invoicePaymentConfirmed` → `extensions/stripe/emails/invoice.vue` via dispatcher; stripe deja de importar `MailService` | Cero HTML inline en `MailService` (lint rule); `stripe.service.ts` no importa `MailService` |
| O10 | Migrar patrones C (affiliate, upload-post inline HTML) a templates `.vue` via dispatcher | Cero HTML inline en extensiones (lint rule) |
| O11 | Workspace `packages/emails/` con Maizzle framework + `Layout.vue` compartido | `packages/emails/package.json` con `"type": "module"`, deps `@maizzle/framework` + `@maizzle/tailwindcss` |
| O12 | Migración incremental en 5 fases sin big-bang | Fases 0-4 con criterios de salida y rollback en `06-migration-phases.md` |

## No-objetivos (out-of-scope)

- **Reemplazar Nodemailer** — el transport SMTP se mantiene. Solo se unifica el renderer arriba.
- **Reemplazar BullMQ** — la queue (opcional via `WORKER_HOST` env) se mantiene. Se asegura que `invoicePaymentConfirmed` la use, pero no se rediseña la queue.
- **Cambiar el módulo `nestjs-i18n`** — se mantiene `nestjs-i18n` 10.5.1. Los strings se pre-resuelven antes de pasarlos como props.
- **Migrar a `@nestjs-modules/mailer`** — NO instalado, NO se añade. El renderer unificado es `TemplateRenderer` propio, no ese paquete.
- **Cambiar la config `mail.default*` / `app.notificationEmail`** — se mantienen las keys, se unifica su uso.
- **Editor visual de emails** — fuera de scope. Los templates se editan en código.
- **Testing de email rendering visual cross-client (Litmus, Email on Acid)** — fuera de scope. Se valida render básico.
- **Newsletter** — documentada como fase futura en extensión `web` (ver PRD `astro-public`), NO implementada aquí.
- **Migración del frontend Nuxt** — fuera de scope. Este PRD es backend-only.
- **Cambiar el modelo de envío (sync vs queue)** — se mantiene el comportamiento actual (queue opcional via `WORKER_HOST`). Solo `invoicePaymentConfirmed` pasa a queue via dispatcher.
- **Commitear `build/`** — OBSOLETO. Con `render()` runtime no hay `build/` para commitear. Esta no-decisión reemplaza la decisión v1 de "commitear build/".
- **Build step para emails** — NO hay build step. `render()` lee `.vue` del disco on-demand.

## KPIs / métricas de éxito

| Métrica | Target | Verificación |
|---------|--------|--------------|
| `render()` runtime per email (first render) | < 500ms | Benchmark Fase 0 (NFR-001) |
| `render()` runtime per email (cache hit) | < 5ms | Log métrica Fase 2 (NFR-001) |
| Cero `handlebars` en deps | `rg "handlebars" apps/back/package.json` sin resultados | Grep check Fase 1 (NFR-003) |
| Cero `.hbs` files en repo | `rg "\.hbs$" apps/back/src/` sin resultados | Grep check Fase 1 (NFR-004) |
| Cero `Handlebars.compile` en `apps/back/src/` | `rg "Handlebars.compile" apps/back/src/` sin resultados | Grep check Fase 2 (NFR-003) |
| Cero `fs.readFile` en renderer paths | `rg "fs.readFile" apps/back/src/infrastructure/mailer/ apps/back/src/modules/communications/email-queue/` sin resultados | Grep check Fase 2 |
| 1 renderer con cache | Cero rendering directo en `MailerService`/`EmailProcessor` | Grep check Fase 2 |
| Cache hit ratio runtime | > 95% (tras warm-up, misma template + mismos props) | Log métrica Fase 2 (NFR-002) |
| 1 props shape | Cero referencia a `app_url` divergente — un único `buildEmailProps()` | Grep check Fase 2 |
| Auto-discovery encuentra templates | Renderer encuentra `.vue` en `extensions/*/emails/` + `modules/*/emails/` + `packages/emails/emails/` | Test Fase 3 |
| `from` unificado | Ambos pipelines usan `mail.defaultName <mail.defaultEmail>` | Grep check Fase 2 |
| Cero HTML inline en extensiones | `rg "innerHTML\|<html.*string" apps/back/src/extensions` sin resultados (lint rule enforced) | Lint gate Fase 4 |
| Cero HTML inline en `MailService` | `invoicePaymentConfirmed` NO existe; stripe usa `extensions/stripe/emails/invoice.vue` via dispatcher | Inspección Fase 4 |
| Stripe no importa `MailService` | `rg "MailService" apps/back/src/extensions/stripe/` sin resultados | Grep check Fase 4 |
| i18n extensiones via props | Email de task con `lang=en` renderiza strings en inglés (props pre-resueltos) | Test Fase 4 |
| ESM compatible | `packages/emails/` `type:module`, `dynamic import('@maizzle/framework')` funciona desde `apps/back/` CJS | Spike Fase 0 (NFR-006) |
| Tailwind 4 coexistencia | Frontend `apps/front/` build sin regresión tras `@maizzle/tailwindcss` en workspace | `pnpm --filter front build` Fase 0 (NFR-007) |

## Stakeholders / módulos afectados

| Módulo / extensión | Impacto |
|--------------------|---------|
| `apps/back/src/modules/communications/mail/` (core) | Migración completa: Maizzle v5→v6 `render()`, eliminar Handlebars, `TemplateRenderer`, `buildEmailProps`, refactor `MailerService` + `EmailProcessor` + `MailService` |
| `apps/back/src/core/spec-engine/` (NotificationDispatcher) | Refactor para usar `TemplateRenderer.render(path, props)` (eliminar su cache propio + Handlebars), unificar props shape y `from` |
| `apps/back/src/extensions/tasks/` | Migrar `task-assigned.hbs`/`stale-tasks.hbs` a `.vue` en `tasks/emails/` |
| `apps/back/src/extensions/stripe/` | `invoicePaymentConfirmed` elimina de core; stripe crea `extensions/stripe/emails/invoice.vue` y usa dispatcher; **deja de importar `MailService`** (`stripe.service.ts:8,24,601`) |
| `apps/back/src/extensions/affiliate/` | Migrar HTML inline strings a templates `.vue` via dispatcher |
| `apps/back/src/extensions/upload-post/` | Migrar HTML inline strings a templates `.vue` via dispatcher |
| `apps/back/src/infrastructure/mailer/mailer.service.ts` | Refactor: eliminar `fs.readFile` + `Handlebars.compile`, usar `TemplateRenderer.render(path, props)` |
| `apps/back/src/modules/communications/email-queue/email.processor.ts` | Refactor: eliminar `fs.readFile` + `Handlebars.compile` (líneas 77-78), usar `TemplateRenderer.render(path, props)` |
| `apps/back/src/modules/communications/mail/mail-templates/` | Eliminar `.hbs` files (`activation.hbs`, `reset-password.hbs`, `confirm-new-email.hbs`, `layouts/main.hbs`); migrar a `.vue` (viven en `packages/emails/emails/`); eliminar `build/` (no existe con `render()`) |
| `apps/back/maizzle.config.js`, `tailwind.email.config.js` | Eliminar ambos — `render()` no requiere config de build |
| `apps/back/scripts/flatten-maizzle-output.js` | Eliminar (no hay build output que aplanar) |
| `apps/back/package.json` | Bump/eliminar `@maizzle/framework` (pasa a `packages/emails/`), **eliminar `handlebars`**, eliminar `tailwindcss-preset-email`, eliminar `maizzle:build`/`maizzle:serve` scripts |
| `packages/emails/` (NUEVO workspace) | Crear: `package.json` con `"type": "module"`, deps `@maizzle/framework` + `@maizzle/tailwindcss`; `emails/Layout.vue` compartido; `emails/*.vue` core (activation, reset-password, confirm-new-email) |
| `pnpm-workspace.yaml` | Sin cambios — ya incluye `packages/*` |

## Próximos pasos

1. Resolver Q-009 (API boundary: dynamic import directo vs API en `packages/emails/`), Q-010 (alias `@emails/Layout.vue`), Q-011 (render performance) y Q-012 (props serialization) en Fase 0 con spike técnico.
2. Asignar owner.
3. Aprobar Fase 0 (setup + spike) en `06-migration-phases.md`.