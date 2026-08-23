---
doc: email-system-v2/00-index
title: "Email System v2 — PRD Índice"
status: archived
created: 2026-08-20
archived: 2026-08-23
---

# Email System v2 — PRD Índice

**Estado**: archived
**Owner**: Foundation
**Creado**: 2026-08-20
**Slug**: `email-system-v2`
**Alcance**: Migración Maizzle v5→v6 + **eliminación de Handlebars** + unificación del sistema de email del backend + templates desde cualquier sitio (extensiones Y módulos) + renderer runtime con `render()` API de Maizzle v6 (Vue props) + auto-discovery por convención
**Dependencia**: Depende de PRD `astro-public` (FR-034/035 contacto). Si `astro-public` se implementa primero, el template de contacto se reescribe en v6 durante esta migración (1 template, ~30 líneas, costo aceptable — R-ASTRO-1).

## Resumen

PRD para la migración completa del sistema de email del backend Foundation. El sistema actual es **dos pipelines paralelos rotos que no comparten nada**: (1) `MailService` core con Maizzle v5.5.0 build-time + Handlebars runtime en `apps/back/src/modules/communications/mail/`, y (2) `NotificationDispatcher` del spec-engine con Handlebars runtime only en `apps/back/src/core/spec-engine/`. Ambos duplican `fs.readFile` + `Handlebars.compile` (`mailer.service.ts`, `email.processor.ts:77-78`, `notification-dispatcher.ts:425-467`), tienen context shape divergente (`app_url` vs `app.url`), `from` inconsistente, y cero i18n en extensiones. El build está roto: `build/` no se commitea, fresh checkout no puede enviar emails hasta que alguien corra `pnpm maizzle:build` manualmente. Tres patrones inconsistentes en extensiones (stripe importa `MailService`, tasks usa `.hbs` propias, affiliate/upload-post construyen HTML inline).

**El cambio fundamental respecto al v1 de este PRD**: el v1 asumía Maizzle v6 build-time + Handlebars runtime preservando `{{handlebars}}` en el HTML output, con `build/` commiteado. **Eso era un error arquitectural.** La decisión del usuario (basada en la verificación de la `render()` API de Maizzle v6, https://maizzle.com/docs/deploy/nodemailer) es **ELIMINAR Handlebars completamente** y usar `render()` de Maizzle v6 que compila `.vue` + Tailwind + inlines CSS **en runtime** pasando los datos dinámicos como **Vue props**. Resultado:

- **NO build step** para email HTML — los `.vue` son source, `render()` los lee del disco on-demand.
- **NO `build/`** para commitear — la decisión v1 de "commitear build/" queda **OBSOLETA**.
- **NO Handlebars** — los datos dinámicos son Vue props (`<p>Hola {{ name }}</p>` donde `name` es un prop). Se elimina la dependencia `handlebars` de `apps/back/package.json`.
- **NO `flatten-maizzle-output.js`** — no hay build output que aplanar.
- **NO `tailwind.email.config.js`** ni `tailwindcss-preset-email` — reemplazados por `@maizzle/tailwindcss` (Tailwind 4) que coexiste con el Tailwind 4.1.3 del frontend (verificado: `apps/front/package.json` ya tiene `tailwindcss ^4.1.3` + `@tailwindcss/vite ^4.1.3` + `daisyui ^5.5.19`).
- `TemplateRenderer` es un wrapper fino sobre `render()` con cache por `path + propsHash`.
- Templates pueden vivir en `extensions/*/emails/`, `modules/*/emails/`, o `packages/emails/emails/` (auto-discovery por convención, **sin** subcarpeta `templates/` — el usuario dijo explícitamente "quitaría el nombre de templates y sería ej: extensions/*/emails").
- i18n strings se pre-resuelven y se pasan como props (no hay helper `{{t "key"}}` en templates).
- Stripe migra `invoicePaymentConfirmed` a un `extensions/stripe/emails/invoice.vue` via dispatcher unificado; `MailService.invoicePaymentConfirmed()` se ELIMINA; stripe deja de importar `MailService`.

## Tabla de contenidos

| # | Archivo | Resumen |
|---|---------|---------|
| 00 | `00-index.md` | Este índice. Estado, owner, TOC, convenciones de numeración. |
| 01 | `01-overview.md` | Motivación (2 sistemas paralelos rotos + Handlebars como deuda), objetivos medibles, no-objetivos, KPIs. |
| 02 | `02-architecture.md` | Arquitectura target (renderer runtime con `render()`, workspace `packages/emails/`, auto-discovery por convención), decisiones D-01 a D-04, diagrams. |
| 03 | `03-requirements.md` | FR-NNN (EARS) + NFR-NNN: eliminación Handlebars, `render()` runtime, workspace `packages/emails/`, auto-discovery, renderer unificado, context unificado, i18n como props, debt cleanup. |
| 04 | `04-context.md` | Stack actual vs target (Tailwind 4 confirmado en frontend), comparación de los 2 sistemas, constraints three-tier, supuestos, limitaciones. |
| 05 | `05-risks-and-tradeoffs.md` | Riesgos R-RENDER-1, R-EXT-1, R-CACHE-1, R-PERF-1, R-DYNAMIC-1, R-MIGR-1, R-VUE-RUNTIME-1, R-ASTRO-1 + trade-offs + matriz severidad. |
| 06 | `06-migration-phases.md` | 5 fases: Setup+spike, Core templates+eliminar Handlebars, Renderer+Context, Templates desde cualquier sitio+auto-discovery, i18n+debt cleanup. Entregables, exit criteria, rollback. |
| 07 | `07-open-questions.md` | Q-001 a Q-008 RESUELTAS. Q-009 a Q-012 nuevas (API boundary, Layout alias, render performance, props serialization). |
| 08 | `08-definition-of-done.md` | Gates funcionales, técnicos, performance, renderer tests, cero Handlebars, cero `.hbs`, cero inline HTML. |

## Convenciones de numeración

- `FR-NNN` — requisitos funcionales (EARS notation en `03-requirements.md`).
- `NFR-NNN` — requisitos no funcionales.
- `Q-NNN` — open questions en `07-open-questions.md`.
- `R-NNN` — riesgos en `05-risks-and-tradeoffs.md` (formato `R-PREFIX-NN` con prefijos temáticos `R-RENDER-*`, `R-EXT-*`, `R-CACHE-*`, `R-PERF-*`, `R-DYNAMIC-*`, `R-MIGR-*`, `R-VUE-*`, `R-ASTRO-*`).
- `D-NN` — decisiones en `02-architecture.md`.
- `Fase <N>` — fases de migración en `06-migration-phases.md` (Fase 0 a Fase 4).

## Flujo posterior

```
PRD email-system-v2 (este) → sdd-explore → sdd-propose → sdd-spec → sdd-design → sdd-tasks → sdd-apply → sdd-verify
```

## Próximo paso

Open questions Q-009 (API boundary), Q-010 (alias Layout.vue), Q-011 (render performance) y Q-012 (props serialization) se resuelven con spike técnico en Fase 0. Asignar owner, aprobar Fase 0.