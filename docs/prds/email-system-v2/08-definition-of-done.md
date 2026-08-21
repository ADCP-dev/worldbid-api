---
doc: email-system-v2/08-definition-of-done
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
| TemplateRenderer cache hit | Segunda call a mismo path+props NO re-renderiza (cache hit) | Test Fase 2 |
| TemplateRenderer cache miss | Props distintos → re-renderiza (cache miss) | Test Fase 2 |
| TemplateRenderer dynamic import | `import('@maizzle/framework')` lazy-load una sola vez | Test Fase 2 |
| TemplateRenderer clearCache | `clearCache(path)` invalida entries de ese path; `clearCache()` limpia todo | Test Fase 2 |
| TemplateRenderer props injection | `buildEmailProps()` produce shape correcto, template recibe `appName`/`appUrl`/etc. | Test Fase 2 |
| Email activación E2E | Registro → email enviado desde `packages/emails/emails/activation.vue` via `render()` | Test Fase 1 |
| Email reset password E2E | Reset password → email enviado desde `packages/emails/emails/reset-password.vue` | Test Fase 1 |
| Email confirm email E2E | Confirm new email → email enviado desde `packages/emails/emails/confirm-new-email.vue` | Test Fase 1 |
| Email invoice E2E | Stripe invoice event → email enviado desde `extensions/stripe/emails/invoice.vue` via dispatcher + queue (no sync) | Test Fase 3 |
| Email task assigned E2E | Task assigned → email enviado desde `extensions/tasks/emails/task-assigned.vue` | Test Fase 3 |
| Email affiliate E2E | Affiliate event → email enviado desde template `.vue` (no inline HTML) | Test Fase 3 |
| Email upload-post E2E | Upload-post event → email enviado desde template `.vue` (no inline HTML) | Test Fase 3 |
| i18n extension email (props) | Email de task con `lang=en` → strings en inglés (props pre-resueltos, no `{{t}}`) | Test Fase 4 |
| i18n invoice email (props) | Email de invoice con `lang=en` → strings en inglés | Test Fase 4 |
| Extension isolation | Error de sintaxis en `extensions/tasks/emails/broken.vue` → render de tasks falla con log PERO `affiliate/emails/` + `packages/emails/emails/activation.vue` siguen OK | Test Fase 3 |
| Auto-discovery | Drop `extensions/test/emails/dropped.vue` → `EmailDiscoveryService.findAll()` lo encuentra → `TemplateRenderer.render()` lo renderiza | Test Fase 3 |
| Type-check | `pnpm check-types` pasa en `apps/back` + `packages/emails` | CI gate |
| Lint | `pnpm lint` pasa en `apps/back` (incluye lint rules cero `.hbs`, cero inline HTML, cero handlebars) | CI gate (NFR-003, NFR-004, NFR-005) |

> Coverage de `TemplateRenderer` debe ser alto (cache, dynamic import, clearCache, props injection) por el blast radius (R-RENDER-1).

## Lint

| Gate | Comando | Verificación |
|------|---------|--------------|
| ESLint | `pnpm lint` (`apps/back`) | Sin errores. Warnings permitidos solo con justificación. |
| Prettier | `pnpm format` (check) | Sin diffs (archivos ya formateados). |
| NFR-003 | Cero `handlebars` en `apps/back/package.json` | `rg "handlebars" apps/back/package.json` sin resultados |
| NFR-004 | Cero `.hbs` files en `apps/back/src/` | `rg "\.hbs$" apps/back/src/` sin resultados (lint rule enforced) |
| NFR-005 | Cero inline HTML en `MailService` | `rg "innerHTML\|<html.*string\|<body" apps/back/src/modules/communications/mail/mail.service.ts` sin resultados |
| FR-003 | Cero `Handlebars.compile` / `import Handlebars` en `apps/back/src/` | `rg "Handlebars.compile\|import Handlebars\|from 'handlebars'" apps/back/src/` sin resultados (lint rule enforced) |
| FR-062 | Cero inline HTML en `extensions/` | `rg "innerHTML\|<html.*string\|<body" apps/back/src/extensions` sin resultados |
| FR-061 | Stripe no importa `MailService` | `rg "MailService" apps/back/src/extensions/stripe/` sin resultados |

## Type-check

| Gate | Comando |
|------|---------|
| TypeScript estricto | `pnpm check-types` pasa en `apps/back` + `packages/emails` |
| Sin `any` | `rg "\bany\b" apps/back/src/modules/communications/mail apps/back/src/core/spec-engine` sin resultados en nuevas firmas |

## Eliminación Handlebars (FR-001 a FR-006)

| Criterio | Verificación |
|----------|--------------|
| Cero `handlebars` en deps | `rg "handlebars" apps/back/package.json` sin resultados (FR-001, NFR-003) |
| Cero `.hbs` files en repo | `rg "\.hbs$" apps/back/src/` sin resultados — los 6 archivos originales (`activation.hbs`, `reset-password.hbs`, `confirm-new-email.hbs`, `layouts/main.hbs`, `task-assigned.hbs`, `stale-tasks.hbs`) no existen (FR-002, NFR-004) |
| Cero `Handlebars.compile` | `rg "Handlebars.compile" apps/back/src/` sin resultados (FR-003) |
| Cero `import Handlebars` | `rg "import Handlebars\|from 'handlebars'" apps/back/src/` sin resultados (FR-003) |
| `flatten-maizzle-output.js` eliminado | `apps/back/scripts/flatten-maizzle-output.js` no existe (FR-004) |
| `tailwind.email.config.js` eliminado | `apps/back/tailwind.email.config.js` no existe (FR-005) |
| `tailwindcss-preset-email` eliminado | `rg "tailwindcss-preset-email" apps/back/package.json` sin resultados (FR-005) |
| `maizzle.config.js` eliminado | `apps/back/src/modules/communications/mail/mail-templates/maizzle.config.js` no existe (FR-006) |
| `maizzle:build`/`maizzle:serve` scripts eliminados | `rg "maizzle:build\|maizzle:serve" apps/back/package.json` sin resultados (FR-004) |

## Renderer runtime con `render()` (FR-020 a FR-024)

| Criterio | Verificación |
|----------|--------------|
| `TemplateRenderer` service existe | `apps/back/src/modules/communications/mail/template-renderer/template-renderer.service.ts` con cache `Map<path+propsHash, { html, plaintext }>` y dynamic import lazy-load de `render()` (FR-020) |
| `render()` runtime verificado < 500ms | Benchmark Fase 0: first render < 500ms, cache hit < 5ms (NFR-001, Q-011) |
| `MailerService` usa `TemplateRenderer` | `rg "fs.readFile\|Handlebars.compile" apps/back/src/infrastructure/mailer/` sin resultados (FR-021) |
| `EmailProcessor` usa `TemplateRenderer` | `rg "fs.readFile\|Handlebars.compile" apps/back/src/modules/communications/email-queue/` sin resultados (FR-022) |
| `MailService` usa `TemplateRenderer` | `mail.service.ts` delega rendering, sin paths directos (FR-023) |
| `NotificationDispatcher` usa `TemplateRenderer` | `notification-dispatcher.ts` usa `TemplateRenderer.render(path, props)`, sin cache `Map` propio (línea 109 eliminada), sin `Handlebars.compile` (línea 447 eliminada), sin `fs.readFile` (línea 437 eliminada) (FR-024) |
| Cache hit ratio > 95% | Log métrica tras warm-up (NFR-002) |

## Context/props unificado (FR-030 a FR-033)

| Criterio | Verificación |
|----------|--------------|
| `buildEmailProps()` helper existe | `apps/back/src/modules/communications/mail/build-email-props.helper.ts` con shape `EmailProps` (FR-030) |
| Props shape unificado | Ambos pipelines reciben mismo shape (`appName`, `appUrl`, `notificationEmail`) — FR-031 |
| Cero `app_url`/`app_name` divergentes | `rg "app_url\|app_name" apps/back/src/modules/communications/mail/ apps/back/src/core/spec-engine/` sin resultados en paths migrados (FR-031) |
| `from` unificado | Ambos pipelines usan `mail.defaultName <mail.defaultEmail>` (FR-032) |
| `app.notificationEmail` recipient-only | NO se usa como `from` en ningún pipeline (FR-033) — grep check en `notification-dispatcher.ts` |

## Workspace `packages/emails/` (FR-070 a FR-072)

| Criterio | Verificación |
|----------|--------------|
| `packages/emails/` workspace existe | `packages/emails/package.json` con `"type": "module"`, `@maizzle/framework ^6.x`, `@maizzle/tailwindcss ^1.x` (FR-070) |
| `dynamic import('@maizzle/framework')` funciona | Desde `apps/back/` CJS, dynamic import retorna `render` function (FR-071, Q-009) — o API boundary consumida |
| `packages/emails/emails/Layout.vue` existe | Shared layout importado por templates (FR-042) |
| `@emails/Layout.vue` alias resuelve | `import Layout from '@emails/Layout.vue'` funciona en `render()` (Q-010) |
| Auto-discovery encuentra templates | `EmailDiscoveryService.findAll()` retorna `.vue` de `extensions/*/emails/` + `modules/*/emails/` + `packages/emails/emails/` (FR-072) |

## Templates desde cualquier sitio (FR-040 a FR-043)

| Criterio | Verificación |
|----------|--------------|
| Estructura por extensión | `extensions/{tasks,affiliate,upload-post,stripe}/emails/*.vue` existen (FR-040) |
| Sin `templates/` subfolder | `rg "templates/emails/" apps/back/src/extensions/` sin resultados — directamente `emails/` |
| Sin `maizzle.config.ts` per-extension | `rg "maizzle.config.ts" apps/back/src/extensions/` sin resultados (FR-041) — `render()` no requiere config local |
| Layout via import (no config) | Templates importan `@emails/Layout.vue`, no via `components.folders` config (FR-042) |
| Auto-discovery por convención | `EmailDiscoveryService` escanea `extensions/*/emails/` + `modules/*/emails/` + `packages/emails/emails/` (FR-043) |

## i18n como props (FR-050, FR-051)

| Criterio | Verificación |
|----------|--------------|
| i18n pre-resuelto en `buildEmailProps()` | `buildEmailProps()` usa `I18nService.t(key, { lang })` para pre-resolver strings (FR-050) |
| Cero helper `{{t}}` en templates | `rg "{{t " apps/back/src/` sin resultados (FR-050) |
| Templates reciben strings como props | `{{ greeting }}`, `{{ bodyText }}` son props pre-resueltos, NO `{{t "key"}}` (FR-051) |
| i18n funciona | Email de task con `lang=en` → strings en inglés (NFR-006) |
| Keys registradas | `apps/back/src/i18n/` (es/en) contiene keys para tasks, affiliate, upload-post, stripe |

## Debt cleanup (FR-060 a FR-063)

| Criterio | Verificación |
|----------|--------------|
| `MailService.invoicePaymentConfirmed()` eliminado | `rg "invoicePaymentConfirmed" apps/back/src/modules/communications/mail/mail.service.ts` sin resultados (FR-060) |
| `extensions/stripe/emails/invoice.vue` existe | Renderizado via `NotificationDispatcher` (FR-060) |
| Stripe no importa `MailService` | `rg "MailService" apps/back/src/extensions/stripe/` sin resultados — `stripe.service.ts:8,24,601` eliminados (FR-061) |
| Invoice via queue (no sync) | Envío via `QueuedMailerService` o dispatcher con queue — log muestra "queued" no "sent sync" (FR-063) |
| Cero inline HTML affiliate | `rg "innerHTML\|<html.*string\|<body" apps/back/src/extensions/affiliate` sin resultados (FR-062) |
| Cero inline HTML upload-post | `rg "innerHTML\|<html.*string\|<body" apps/back/src/extensions/upload-post` sin resultados (FR-062) |
| Lint rule enforced | CI gate rechaza PRs con inline HTML en `extensions/` o `MailService`, con `.hbs` files, o con `handlebars` import (NFR-003, NFR-004, NFR-005) |

## ESM + Tailwind coexistencia (NFR-006, NFR-007)

| Criterio | Verificación |
|----------|--------------|
| `packages/emails/` type:module | `packages/emails/package.json` tiene `"type": "module"` (NFR-006) |
| Dynamic import funciona desde CJS | `dynamic import('@maizzle/framework')` desde `apps/back/` retorna `render` (NFR-006, Q-009) — o API boundary |
| Frontend sin regresión | `pnpm --filter front build` funciona tras `@maizzle/tailwindcss` en `packages/emails/` (NFR-007) |
| Tailwind 4.1.3 frontend intacto | `apps/front/package.json` mantiene `tailwindcss ^4.1.3` + `daisyui ^5.5.19` |

## Documentación

| Requisito | Verificación |
|-----------|--------------|
| `docs/ARCHITECTURE.md` actualizado | `pnpm docs:sync` ejecutado sin errores (usuario lo ejecuta — NO ejecutar en este PRD) |
| Doc módulo mail actualizado | `docs/modules/email.md` (o `docs/modules/mail.md`) con nueva arquitectura: `TemplateRenderer`, `buildEmailProps`, `render()` runtime, auto-discovery, `packages/emails/` |
| Docs extensiones actualizadas | `docs/extensions/{tasks,affiliate,upload-post,stripe}.md` con sección "Email templates" describiendo `emails/*.vue` + import `@emails/Layout.vue` + dispatcher |
| PRD actualizado | Open questions Q-001 a Q-008 marcadas RESUELTAS con decisión; Q-009 a Q-012 resueltas en Fase 0 con decisión documentada |

## Verificación final (checklist)

- [ ] Todos los FR-NNN relevantes cumplidos (ver `03-requirements.md`)
- [ ] Todos los NFR-NNN cumplidos
- [ ] Open questions Q-001 a Q-008 RESUELTAS (decisiones del usuario); Q-009 a Q-012 resueltas en Fase 0
- [ ] Tests gate passing (renderer cache/dynamic import/clearCache/props, E2E emails, extension isolation, auto-discovery)
- [ ] Lint + type-check passing (`apps/back` + `packages/emails`)
- [ ] Build passing (`apps/back` + `apps/front` sin regresión)
- [ ] Docs actualizadas + `pnpm docs:sync` ejecutado (usuario lo ejecuta)
- [ ] **Cero `handlebars` en `apps/back/package.json` deps** (NFR-003) — `rg "handlebars" apps/back/package.json` sin resultados
- [ ] **Cero `.hbs` files en repo** (NFR-004) — `rg "\.hbs$" apps/back/src/` sin resultados
- [ ] **Cero `Handlebars.compile` en `apps/back/src/`** (FR-003) — `rg "Handlebars.compile" apps/back/src/` sin resultados
- [ ] **Cero `fs.readFile` en renderer paths** — `rg "fs.readFile" apps/back/src/infrastructure/mailer/ apps/back/src/modules/communications/email-queue/ apps/back/src/core/spec-engine/` sin resultados
- [ ] **`render()` runtime verificado < 500ms primera render, < 5ms cache hit** (NFR-001)
- [ ] **`packages/emails/` workspace con type:module, `@maizzle/framework`, `@maizzle/tailwindcss`** (FR-070)
- [ ] **`dynamic import('@maizzle/framework')` funciona desde `apps/back/` CJS** (NFR-006, Q-009) — o API boundary
- [ ] **Auto-discovery encuentra templates en `extensions/*/emails/` + `modules/*/emails/` + `packages/emails/emails/`** (FR-072)
- [ ] **Stripe no importa `MailService`, usa dispatcher con `extensions/stripe/emails/invoice.vue`** (FR-060, FR-061)
- [ ] **i18n funciona via props pre-resueltas (no helper en template)** (FR-050, FR-051) — `rg "{{t " apps/back/src/` sin resultados
- [ ] `TemplateRenderer` con cache por `path+propsHash`
- [ ] Props shape unificado (cero `app_url`/`app_name` divergentes)
- [ ] Cero inline HTML en `extensions/` y `MailService`
- [ ] `from` unificado en `mail.default*` en ambos pipelines
- [ ] `app.notificationEmail` es recipient-only
- [ ] Extensiones con `emails/*.vue` (sin `templates/` subfolder) + import `@emails/Layout.vue`
- [ ] Decisiones clave guardadas en Engram (`mem_save`)

## Out of DoD (no aplica)

- Reemplazar Nodemailer (out-of-scope — transport SMTP se mantiene).
- Reemplazar BullMQ (out-of-scope — queue opcional se mantiene, solo `invoicePaymentConfirmed` pasa a queue via dispatcher).
- Migrar a `@nestjs-modules/mailer` (out-of-scope — renderer propio).
- Editor visual de emails (out-of-scope).
- Testing visual cross-client (Litmus, Email on Acid) (out-of-scope).
- Newsletter (fase futura, no implementada — ver PRD `astro-public`).
- Migración del frontend Nuxt (out-of-scope).
- Cache distribuido Redis para templates (out-of-scope — cache en memoria `TemplateRenderer`).
- Build step para emails (out-of-scope — `render()` runtime, no build, D-03).
- Commitear `build/` (OBSOLETO — no hay `build/` con `render()` runtime).

## Criterios de no-aceptación (anti-DoD)

- ❌ `handlebars` en `apps/back/package.json` deps (FR-001, NFR-003 no cumplidos).
- ❌ Archivos `.hbs` en `apps/back/src/` (FR-002, NFR-004 no cumplidos).
- ❌ `Handlebars.compile` o `import Handlebars` en `apps/back/src/` (FR-003 no cumplido).
- ❌ `fs.readFile` directo en `MailerService`/`EmailProcessor`/`NotificationDispatcher` (FR-021, FR-022, FR-024 no cumplidos — renderer no unificado).
- ❌ HTML inline en `extensions/` o `MailService` (NFR-005, FR-060, FR-062 no cumplidos).
- ❌ Props shape divergente (`app_url` vs `app.url`) en templates migrados (FR-031 no cumplido).
- ❌ `app.notificationEmail` usado como `from` en algún pipeline (FR-033 no cumplido).
- ❌ Templates de extensión hardcodeando Spanish sin i18n (FR-051 no cumplido).
- ❌ Helper `{{t "key"}}` en templates `.vue` (FR-050 no cumplido — i18n debe ser props pre-resueltos).
- ❌ `MailService.invoicePaymentConfirmed()` existe o stripe importa `MailService` (FR-060, FR-061 no cumplidos).
- ❌ `invoicePaymentConfirmed` con envío sync (FR-063 no cumplido).
- ❌ Extensiones con `templates/emails/` subfolder en vez de `emails/` directo (FR-040 no cumplido).
- ❌ `maizzle.config.ts` local por extensión (FR-041 no cumplido — `render()` no requiere config local).
- ❌ `NotificationDispatcher` con cache `Map` propio (FR-024 no cumplido — consolidado en `TemplateRenderer`).
- ❌ Error en una extensión rompiendo el render del core o de otras extensiones (R-EXT-1 no mitigado — aislamiento roto).
- ❌ Tailwind 4.1.3 del frontend roto tras `@maizzle/tailwindcss` (NFR-007 no cumplido).
- ❌ `dynamic import('@maizzle/framework')` falla y no hay API boundary (NFR-006, Q-009 no cumplidos).
- ❌ `console.log` en backend (usar NestJS Logger).
- ❌ `@nestjs-modules/mailer` instalado (out-of-scope — renderer propio).
- ❌ Build step para emails o `build/` en repo (D-03 violado — no debe haber build step).
- ❌ Migración big-bang sin fases incrementales (R-MIGR-1 no mitigado).

## Resumen de gates por fase

| Fase | Gates críticos |
|------|----------------|
| 0 | `packages/emails/` workspace creado, spike Q-009 a Q-012 resuelto, `render()` benchmark < 500ms first render (R-PERF-1, Q-011), `dynamic import` funciona (R-DYNAMIC-1, Q-009), `@emails/Layout.vue` alias resuelve (Q-010), frontend sin regresión (NFR-007) |
| 1 | 4 templates core `.vue` en `packages/emails/`, `Layout.vue`, Handlebars eliminado de deps + `.hbs` files + `Handlebars.compile`, `flatten-maizzle-output.js` + `tailwind.email.config.js` + `tailwindcss-preset-email` eliminados, emails de auth enviados via `render()`, `MailerService` + `EmailProcessor` refactorizados |
| 2 | `TemplateRenderer` con cache `path+propsHash`, `buildEmailProps()` unificado, `NotificationDispatcher` refactorizado (cache `Map` :109 + `Handlebars.compile` :447 + `fs.readFile` :437 eliminados), cero `Handlebars.compile` en `apps/back/src/`, `from` unificado, tests renderer pasan, cache hit > 95% |
| 3 | `EmailDiscoveryService` escanea 3 roots, extensiones con `emails/*.vue` (sin `templates/`), tasks migradas, affiliate/upload-post inline HTML migrados, `extensions/stripe/emails/invoice.vue` creado, `MailService.invoicePaymentConfirmed()` eliminado, stripe no importa `MailService`, auto-discovery verificado, aislamiento verificado (R-EXT-1) |
| 4 | i18n pre-resuelto como props (cero `{{t}}` en templates), `lang=en` renderiza inglés, lint rules enforced (cero `.hbs`, cero inline HTML, cero handlebars), docs actualizadas, todos los gates finales cumplidos |