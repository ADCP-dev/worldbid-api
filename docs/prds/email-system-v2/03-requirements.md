---
doc: email-system-v2/03-requirements
title: "Requisitos (FR-NNN EARS + NFR-NNN)"
status: draft
created: 2026-08-20
---

# Requisitos (FR-NNN EARS + NFR-NNN)

Notación EARS. Cada FR referenciado por número en fases (`06-migration-phases.md`) y DoD (`08-definition-of-done.md`).

## Requisitos funcionales (FR-NNN)

### Eliminación Handlebars + dependencias legacy

**FR-001: Eliminar dependencia `handlebars` de `apps/back/package.json`**
THE SYSTEM SHALL remover la dependencia `handlebars` `4.7.8` de `apps/back/package.json`. THE SYSTEM SHALL NO contener `handlebars` en ninguna sección (dependencies, devDependencies) de `apps/back/package.json` tras la migración.

**FR-002: Eliminar todos los archivos `.hbs` del repo**
THE SYSTEM SHALL eliminar los 6 archivos `.hbs` existentes: `apps/back/src/modules/communications/mail/mail-templates/emails/activation.hbs`, `reset-password.hbs`, `confirm-new-email.hbs`, `apps/back/src/modules/communications/mail/mail-templates/layouts/main.hbs`, `apps/back/src/extensions/tasks/templates/task-assigned.hbs`, `apps/back/src/extensions/tasks/templates/stale-tasks.hbs`. THE SYSTEM SHALL NO contener ningún archivo `.hbs` en `apps/back/src/` tras la migración.

**FR-003: Eliminar `Handlebars.compile` de todo `apps/back/src/`**
THE SYSTEM SHALL remover todas las llamadas `Handlebars.compile` de `apps/back/src/`, específicamente de `infrastructure/mailer/mailer.service.ts`, `modules/communications/email-queue/email.processor.ts:77-78`, y `core/spec-engine/notification-dispatcher.ts:425-467`. THE SYSTEM SHALL NO importar `handlebars` en ningún archivo de `apps/back/src/`.

**FR-004: Eliminar `flatten-maizzle-output.js`**
THE SYSTEM SHALL eliminar `apps/back/scripts/flatten-maizzle-output.js` porque con `render()` runtime no hay build output que aplanar. THE SYSTEM SHALL remover el script `maizzle:build` (`maizzle build && node ./scripts/flatten-maizzle-output.js`) y el script `maizzle:serve` de `apps/back/package.json` porque ya no hay build step.

**FR-005: Eliminar `tailwind.email.config.js` + `tailwindcss-preset-email`**
THE SYSTEM SHALL eliminar `apps/back/tailwind.email.config.js` y la dependencia `tailwindcss-preset-email` `^1.4.0` de `apps/back/package.json`. Tailwind 4 via `@maizzle/tailwindcss` vive en `packages/emails/` (FR-070). THE SYSTEM SHALL verificar coexistencia con Tailwind 4.1.3 + DaisyUI 5 del frontend `apps/front/` (ya verificado en `apps/front/package.json`: `tailwindcss ^4.1.3`, `@tailwindcss/vite ^4.1.3`, `daisyui ^5.5.19`).

**FR-006: Eliminar `maizzle.config.js` (CJS)**
THE SYSTEM SHALL eliminar `apps/back/src/modules/communications/mail/mail-templates/maizzle.config.js` (CJS `module.exports`) porque `render()` runtime no requiere config de build. La config de Tailwind 4 via `@maizzle/tailwindcss` se declara inline en `<style>` tags dentro de los `.vue` (directiva `@theme`).

### Renderer runtime con `render()` de Maizzle v6

**FR-020: Crear `TemplateRenderer` service que wraps `render()` con cache**
THE SYSTEM SHALL crear un servicio `TemplateRenderer` en `apps/back/src/modules/communications/mail/template-renderer/template-renderer.service.ts` que wraps `render()` de `@maizzle/framework` via dynamic `import('@maizzle/framework')` (lazy-load una vez), con un cache `Map<string, { html, plaintext }>` keyed por `path + sha256(stableStringify(props))`. WHEN el cache miss, THE SYSTEM SHALL llamar `render(templatePath, { props })` que retorna `{ html, plaintext }`, cachear el resultado, y retornarlo. THE SYSTEM SHALL NO usar `fs.readFile` ni `Handlebars.compile` en `TemplateRenderer`.

**FR-021: `MailerService` usa `TemplateRenderer.render(path, props)`**
THE SYSTEM SHALL refactor `apps/back/src/infrastructure/mailer/mailer.service.ts` (`sendMail()`) para usar `TemplateRenderer.render(templatePath, props)` en lugar de `fs.readFile` + `Handlebars.compile`. THE SYSTEM SHALL NO contener `fs.readFile` ni `Handlebars.compile` ni `import Handlebars` en `mailer.service.ts`.

**FR-022: `EmailProcessor` usa `TemplateRenderer.render(path, props)`**
THE SYSTEM SHALL refactor `apps/back/src/modules/communications/email-queue/email.processor.ts` (`process()` líneas 77-78) para usar `TemplateRenderer.render(templatePath, props)`. THE SYSTEM SHALL NO contener `fs.readFile` ni `Handlebars.compile` ni `import Handlebars` en `email.processor.ts`.

**FR-023: `MailService` usa `TemplateRenderer.render(path, props)`**
THE SYSTEM SHALL refactor `apps/back/src/modules/communications/mail/mail.service.ts` (229 líneas) para delegar el rendering a `TemplateRenderer.render(path, props)` via `MailerService` o `QueuedMailerService`, eliminando cualquier path de rendering directo. THE SYSTEM SHALL NO contener HTML inline ni `Handlebars.compile` en `mail.service.ts`.

**FR-024: `NotificationDispatcher` usa `TemplateRenderer.render(path, props)`**
THE SYSTEM SHALL refactor `apps/back/src/core/spec-engine/notification-dispatcher.ts` (`renderTemplate()` líneas 425-467) para usar `TemplateRenderer.render(templatePath, props)`. THE SYSTEM SHALL eliminar el cache `Map<string, CachedTemplate>` propio del `NotificationDispatcher` (línea 109) — consolidado en `TemplateRenderer`. THE SYSTEM SHALL NO contener `fs.readFile` ni `Handlebars.compile` ni `import Handlebars` en `notification-dispatcher.ts`.

### Context unificado (props shape)

**FR-030: Crear `buildEmailProps()` helper**
THE SYSTEM SHALL crear un helper `buildEmailProps(config, i18n, partial)` en `apps/back/src/modules/communications/mail/build-email-props.helper.ts` que produzca un único shape de Vue props `EmailProps` para ambos pipelines, con campos `appName` (de `mail.defaultName`), `appUrl` (de `app.url`), `notificationEmail` (de `app.notificationEmail`), `subject`, `greeting`, `bodyText`, `buttonText`, `link`, `title`, `user`, `entity`, `lang`, más props extensibles (`[key: string]: unknown`) para datos específicos de extensión.

**FR-031: Unificar props shape (eliminar `app_url` vs `app.url`)**
THE SYSTEM SHALL eliminar la divergencia de context shape entre el pipeline core (`{ app_name, app_url, ... }`) y el spec-engine (`{ app: { url, name, ... } }`), estandarizando en el shape `EmailProps` con `appName`, `appUrl`, `notificationEmail` (camelCase, idiomático Vue props). Todos los templates migrados a `.vue` referencian `{{ appName }}`, `{{ appUrl }}`, NO `{{ app_name }}`, `{{ app_url }}`, NO `{{ app.name }}`, `{{ app.url }}`.

**FR-032: `from` unificado en `mail.default*`**
THE SYSTEM SHALL unificar el header `from` en ambos pipelines a `mail.defaultName <mail.defaultEmail>` (formato `"Name" <email>`). El pipeline spec-engine (`NotificationDispatcher`) SHALL NO usar `app.notificationEmail` raw como `from`.

**FR-033: `app.notificationEmail` es recipient-only**
THE SYSTEM SHALL redefinir `app.notificationEmail` (config en `app-config.type.ts`) como destinatario-only (admin alerts, notificaciones internas), NO como `from`. El `from` se unifica en `mail.defaultName <mail.defaultEmail>` (FR-032).

### Templates desde cualquier sitio + auto-discovery

**FR-040: Templates viven en `extensions/*/emails/` + `modules/*/emails/` + `packages/emails/emails/`**
THE SYSTEM SHALL soportar templates `.vue` en tres roots por convención (SIN subcarpeta `templates/`): `apps/back/src/extensions/<name>/emails/*.vue`, `apps/back/src/modules/<name>/emails/*.vue`, y `packages/emails/emails/*.vue`. Los templates existentes `.hbs` en `extensions/<name>/templates/` se migran a `extensions/<name>/emails/*.vue` (sin `templates/`).

**FR-041: NO se requiere `maizzle.config.ts` per-extension — `render()` funciona con cualquier path `.vue`**
THE SYSTEM SHALL NO requerir `maizzle.config.ts` local por extensión porque `render()` de Maizzle v6 funciona con cualquier path `.vue` on-demand. El shared `Layout.vue` de `packages/emails/emails/Layout.vue` se referencia via import en el `.vue` (FR-042), no via config de Maizzle.

**FR-042: Layout compartido en `packages/emails/`, importado por templates via alias**
THE SYSTEM SHALL crear `packages/emails/emails/Layout.vue` como layout core compartido. Los templates `.vue` (core, extensiones, módulos) lo importan via alias `@emails/Layout.vue` (Q-010, requiere config de path alias en `apps/back/tsconfig.json` o `packages/emails/`) o via path relativo. Un cambio al `Layout.vue` se propaga a todos los templates en el próximo `render()` (no requiere rebuild — `render()` lee del disco on-demand).

**FR-043: Auto-discovery escanea los tres roots por convención**
THE SYSTEM SHALL implementar un `EmailDiscoveryService` que escanee `extensions/*/emails/*.vue` + `modules/*/emails/*.vue` + `packages/emails/emails/*.vue` para descubrir templates por nombre. WHEN se busca un template por nombre, THE SYSTEM SHALL resolver el path absoluto via discovery (o cache de discovery) y pasarlo a `TemplateRenderer.render(path, props)`. Drop folder `emails/*.vue` en cualquier extensión o módulo → funciona sin config manual.

### i18n como props (pre-resuelto, no helper en template)

**FR-050: i18n pre-resuelto en `buildEmailProps()` — strings como Vue props**
THE SYSTEM SHALL pre-resolver las keys i18n en `buildEmailProps()` (o en el dispatcher/context builder) via `nestjs-i18n` `I18nService.t(key, { lang })`, pasando los strings traducidos como Vue props al template. THE SYSTEM SHALL NO registrar ningún helper `{{t "key"}}` en templates `.vue` — los templates reciben strings pre-resueltos (ej: `<p>{{ greeting }}</p>` donde `greeting` ya es un string traducido).

**FR-051: Templates reciben strings traducidos como props**
THE SYSTEM SHALL migrar los templates de extensiones (tasks, affiliate, upload-post, stripe) de strings hardcodeados en español a strings pre-resueltos via `buildEmailProps()` con `lang` del context. Las keys i18n se registran en `apps/back/src/i18n/` (es/en). Los templates `.vue` referencian `{{ greeting }}`, `{{ bodyText }}`, etc. (props pre-resueltos), NO `{{t "key"}}`.

### Debt cleanup

**FR-060: Eliminar `MailService.invoicePaymentConfirmed()` — stripe usa dispatcher con `extensions/stripe/emails/invoice.vue`**
THE SYSTEM SHALL eliminar el método `invoicePaymentConfirmed()` (HTML inline) de `MailService` (`mail.service.ts:189`). THE SYSTEM SHALL crear `apps/back/src/extensions/stripe/emails/invoice.vue` y routear su envío via `NotificationDispatcher` (patrón unificado). Stripe migra del patrón (A) "core MailService" al patrón unificado "dispatcher + `.vue` propio".

**FR-061: Stripe deja de importar `MailService`**
THE SYSTEM SHALL eliminar el `import { MailService } from '@comms/mail/mail.service'` de `apps/back/src/extensions/stripe/services/stripe.service.ts` (líneas 8, 24, 601). Stripe usa `NotificationDispatcher` como las demás extensiones. THE SYSTEM SHALL NO tener referencia a `MailService` en `apps/back/src/extensions/stripe/`.

**FR-062: Migrar extensiones pattern C (affiliate, upload-post inline HTML) a templates `.vue` via dispatcher**
THE SYSTEM SHALL eliminar los HTML inline strings en `extensions/affiliate/` y `extensions/upload-post/` y migrarlos a templates `.vue` en `extensions/<name>/emails/*.vue`, routendolos via `NotificationDispatcher` (patrón unificado).

**FR-063: `invoicePaymentConfirmed` routed via queue (no sync)**
THE SYSTEM SHALL routear el envío del email de invoice a través de la queue BullMQ (via `QueuedMailerService` o el dispatcher con queue), eliminando el envío síncrono actual. La queue es opcional via `WORKER_HOST` env (comportamiento existente preservado).

### Workspace `packages/emails/`

**FR-070: Crear workspace `packages/emails/` con `package.json` type:module**
THE SYSTEM SHALL crear el workspace `packages/emails/` con `package.json` conteniendo `"name": "@foundation/emails"`, `"type": "module"`, `"private": true`, y dependencies `@maizzle/framework` `^6.x` + `@maizzle/tailwindcss` `^1.x`. El workspace se descubre automáticamente via `pnpm-workspace.yaml` (ya incluye `packages/*`).

**FR-071: `apps/back/` consume Maizzle via dynamic import desde el workspace**
THE SYSTEM SHALL configurar `apps/back/` para consumir `@maizzle/framework` via dynamic `import('@maizzle/framework')` desde el workspace `packages/emails/` (ESM-native). `apps/back/package.json` SHALL NO declarar `@maizzle/framework` como dependencia directa — se resuelve via el workspace. Si el dynamic import directo falla (R-DYNAMIC-1), `packages/emails/` SHALL exponer una API boundary (servicio compilado) que `apps/back/` consume (Q-009).

**FR-072: Auto-discovery renderer escanea `extensions/*/emails/` + `modules/*/emails/` + `packages/emails/emails/`**
THE SYSTEM SHALL configurar el `EmailDiscoveryService` para escanear los tres roots por convención (FR-040, FR-043), permitiendo que cualquier extensión, módulo, o el workspace core exponga templates `.vue` que el renderer puede descubrir y renderizar on-demand.

## Requisitos no funcionales (NFR-NNN)

### Performance

**NFR-001: `render()` runtime < 500ms per email (first render), < 5ms (cache hit)**
THE SYSTEM SHALL completar `render()` runtime en menos de 500ms por email en el primer render (compilación Vue SFC + Tailwind inline), y menos de 5ms en cache hit (`TemplateRenderer` cache `path+propsHash` hit). Verificación: benchmark en Fase 0 (Q-011, R-PERF-1).

**NFR-002: Cache hit ratio > 95% en prod**
THE SYSTEM SHALL mantener un cache hit ratio > 95% en `TemplateRenderer` tras warm-up (misma template + mismos props rendereada múltiples veces). Para emails con props únicos (ej: reset-password con hash único), el cache miss en ese path+props es aceptable — Maizzle v6 cachea internamente el SFC compilado. Verificación: log métrica en Fase 2.

### Eliminación Handlebars

**NFR-003: Cero `handlebars` en `apps/back/package.json` deps**
THE SYSTEM SHALL NO contener `handlebars` en ninguna sección de `apps/back/package.json` (dependencies, devDependencies). Verificación: `rg "handlebars" apps/back/package.json` sin resultados.

**NFR-004: Cero `.hbs` files en repo**
THE SYSTEM SHALL NO contener ningún archivo `.hbs` en `apps/back/src/`. Verificación: `rg "\.hbs$" apps/back/src/` sin resultados. Lint rule (eslint custom o grep gate en CI) rechaza PRs que añadan `.hbs` files.

**NFR-005: Cero inline HTML en `MailService` methods**
THE SYSTEM SHALL NO contener HTML inline strings en `apps/back/src/modules/communications/mail/mail.service.ts`. Verificación: `rg "innerHTML\|<html.*string\|<body" apps/back/src/modules/communications/mail/mail.service.ts` sin resultados. Lint rule enforced.

### ESM compatibility

**NFR-006: ESM compatible — `packages/emails/` type:module, `apps/back/` dynamic import funciona**
THE SYSTEM SHALL verificar en Fase 0 (spike) que `dynamic import('@maizzle/framework')` desde NestJS CJS (`apps/back/`) funciona con `packages/emails/` como workspace ESM-native (`"type": "module"`). Si el dynamic import directo falla, `packages/emails/` expone una API boundary compilada que `apps/back/` consume (Q-009, R-DYNAMIC-1).

**NFR-007: Tailwind 4 coexiste con frontend (ya verificado)**
THE SYSTEM SHALL mantener el frontend `apps/front/` sin regresión tras instalar `@maizzle/tailwindcss` (Tailwind 4) en `packages/emails/`. Ya verificado: `apps/front/package.json` tiene `tailwindcss ^4.1.3` + `@tailwindcss/vite ^4.1.3` + `daisyui ^5.5.19`. Tailwind 4 en `packages/emails/` (via `@maizzle/tailwindcss`) coexiste naturalmente en workspaces separados. Verificación: `pnpm --filter front build` sigue funcionando en Fase 0.

## Criterios de aceptación por requisito complejo

- **FR-001 + NFR-003**: Given `apps/back/package.json` post-migración; When `rg "handlebars" apps/back/package.json`; Then sin resultados.
- **FR-002 + NFR-004**: Given repo post-migración; When `rg "\.hbs$" apps/back/src/`; Then sin resultados; Then los 6 archivos `.hbs` originales no existen.
- **FR-003**: Given `apps/back/src/` post-refactor; When `rg "Handlebars.compile\|import Handlebars\|from 'handlebars'" apps/back/src/`; Then sin resultados.
- **FR-020 + FR-024**: Given `TemplateRenderer` creado; When `NotificationDispatcher.renderTemplate()` se invoca; Then usa `TemplateRenderer.render(path, props)`; Then NO existe cache `Map` propio en `notification-dispatcher.ts` (línea 109 eliminada); Then `TemplateRenderer` cachea por `path + propsHash`.
- **FR-030 + FR-031**: Given `buildEmailProps()` helper creado; When `MailerService` invoca send; When `NotificationDispatcher` invoca dispatch; Then ambos reciben el mismo shape `EmailProps` con `appName`/`appUrl`/`notificationEmail`; Then cero referencia a `app_url` o `app_name` o `app.name` divergentes en templates migrados.
- **FR-040 + FR-041 + FR-042 + FR-043**: Given extensión `tasks`; When se drop-a `extensions/tasks/emails/task-assigned.vue`; Then `EmailDiscoveryService.findAll()` lo encuentra; Then `TemplateRenderer.render(path, props)` lo renderiza; Then NO hay `maizzle.config.ts` local requerido; Then el template importa `@emails/Layout.vue` (shared).
- **FR-050 + FR-051**: Given template `task-assigned.vue`; When `lang=en` en props; Then `greeting`, `bodyText` son strings en inglés pre-resueltos por `buildEmailProps()`; Then el template NO contiene `{{t "key"}}` — contiene `{{ greeting }}`.
- **FR-060 + FR-061 + FR-063**: Given `invoicePaymentConfirmed` migrado; When stripe invoice event; Then `extensions/stripe/emails/invoice.vue` se renderiza via `NotificationDispatcher`; Then envío via queue BullMQ (no sync); Then `MailService.invoicePaymentConfirmed()` NO existe; Then `stripe.service.ts` NO importa `MailService`.
- **FR-070 + FR-071 + FR-072**: Given `packages/emails/` workspace creado; When `dynamic import('@maizzle/framework')` desde `apps/back/`; Then funciona (o API boundary consumida); Then `EmailDiscoveryService` escanea `extensions/*/emails/` + `modules/*/emails/` + `packages/emails/emails/`.
- **NFR-001 + Q-011**: Given spike Fase 0; When `render('test.vue', { props })`; Then first render < 500ms; Then cache hit < 5ms; Then la métrica se documenta.
- **NFR-006**: Given spike Fase 0; When `dynamic import('@maizzle/framework')` desde NestJS CJS con `packages/emails/` workspace; Then funciona (o API boundary adoptada si falla — Q-009).
- **NFR-007**: Given `@maizzle/tailwindcss` en `packages/emails/`; When `pnpm --filter front build`; Then sin regresión (Tailwind 4.1.3 del frontend intacto).

## Pendientes de clarificación

- `[NEEDS CLARIFICATION]` Q-009: API boundary — ¿dynamic import directo de `@maizzle/framework` desde `apps/back/`, o `packages/emails/` expone un servicio compilado? Spike Fase 0.
- `[NEEDS CLARIFICATION]` Q-010: Alias `@emails/Layout.vue` en tsconfig, import relativo, o path absoluto? Spike Fase 0.
- `[NEEDS CLARIFICATION]` Q-011: Render performance en prod — ¿`render()` < 500ms primera vez? Spike Fase 0 debe medir.
- `[NEEDS CLARIFICATION]` Q-012: Props serialization — ¿hay datos no serializables que se pasan hoy como context? (ej: Date objects → convertir a ISO string). Spike Fase 0.