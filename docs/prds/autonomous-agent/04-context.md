---
doc: autonomous-agent/04-context
title: "Autonomous Agent — Contexto"
status: draft
created: 2026-07-07
---

# Contexto

## Stack actual

### Backend
- **NestJS** + **TypeORM** + **PostgreSQL**.
- **@nestjs/schedule** 6.1 — `@Cron` decorators en `scheduler.service.ts`.
- **@nestjs/bullmq** 11 + **bullmq** 5.68 — cola `autonomous-agent`, `AutonomousAgentJobProcessor extends WorkerHost`.
- **@comms/email-queue/queued-mailer.service** — notificaciones email.
- **Soft dependency** en content-pipeline via `try/catch require` + `ModuleRef.get({ strict: false })`.
- **Config**: `registerAs('autonomous-agent')` con defaults de cron por env.

### Frontend
- **Nuxt 3** (compatibilityVersion 4) + **Vue 3.5** `<script setup lang="ts">`.
- **Tailwind 4** + **DaisyUI 5.5**.
- **Pinia 3** + **TanStack Vue Query 5.99** (aunque el composable actual usa `$fetch` directo, no Query — Q-001).
- **vee-validate 4** + **zod 4** — schemas en `create.vue` y `[id].vue`.
- **vue-sonner** — toasts.
- **lucide-vue-next** — iconos.
- **date-fns 4** + **@internationalized/date 3** — fechas.
- **ECharts 5.5** + **vue-echarts 7** (via PRD base).
- **cronstrue** + **cron-parser** (via PRD base, ⚠️ Ask first).

## Path aliases

| Alias | Destino | Uso en este PRD |
|-------|---------|-----------------|
| `@ext/autonomous-agent/...` | `apps/back/src/extensions/autonomous-agent/...` | imports backend |
| `@base/ui-app/components/...` | `apps/front/modules/base/ui-app/components/...` | charts, scheduling, automation |
| `@/extensions/autonomous-agent/...` | `apps/front/extensions/autonomous-agent/...` | imports frontend |

## Dependencias

### Backend
- `@nestjs/schedule`, `@nestjs/bullmq`, `bullmq` — ya instalados.
- **content-pipeline extension** — soft dep: `TrendResearchService`, `ContentGeneratorService`, `PublishingService`, `MetricsService`, `IdeaService`, `DraftService`, `ProjectService` resueltos via `ModuleRef`.
- **content-pipeline `ext_cp_metrics`** — soft dep en `FeedbackService` via `@Optional() @InjectRepository`.
- `@comms/email-queue` — `QueuedMailerService`.

### Frontend
- `useContentPipeline()` — composable de la extensión content-pipeline (para listar proyectos).
- `useAutonomousAgent()` — composable propio.
- Componentes base del PRD `base-ui-components` (charts, scheduling, automation).

## Tablas afectadas

| Tabla | Cambio |
|-------|--------|
| `ext_aa_config` | sin cambios (ya tiene cron x4, autoApprove, feedbackData) |
| `ext_aa_run` | sin cambios (ya tiene `output.promptTokens`, `output.completionTokens` en jsonb) |

**No se requieren migraciones nuevas** — el schema ya soporta todo. Los endpoints de stats son queries de agregación sobre `ext_aa_run`.

## Convenciones del proyecto

- **Tablas extension**: prefijo `ext_aa_` (ya aplicado).
- **Entities**: auto-discovered via TypeORM glob.
- **Module**: `extension.module.ts` auto-discovered por `ExtensionLoaderModule`.
- **Frontend layer**: `nuxt.config.ts` con `components: [{ path: './components', pathPrefix: false, global: true }]`.
- **Sidebar injection**: `plugins/nav.ts` push a `useState('nav:menuItems')`.
- **Dashboard widget injection**: `plugins/dashboard-widgets.ts` push a `useState('app:dashboards')`.
- **i18n**: JSON en `apps/front/i18n/locales/{es,en}/` por namespace.
- **Aliases**: `@` antes que `~`, `@base/ui-app/...` para componentes base.
- **TypeScript estricto**, `import type` para tipos, nunca `any`.

## Constraints (three-tier)

| Tier | Constraint |
|------|------------|
| ✅ Always | Usar componentes `@base/ui-app/` (charts, scheduling, automation) del PRD base. No charts inline. |
| ✅ Always | i18n vía JSON en `apps/front/i18n/locales/{es,en}/autonomous-agent.json`. |
| ✅ Always | DaisyUI semantic classes + `useThemeColors()` para charts. |
| ✅ Always | `@Cron` interno del backend NO se toca (solo se exponen crons al frontend). |
| ✅ Always | Soft dependency en content-pipeline via `ModuleRef` / `try/catch require` — nunca import estático que rompa si falta. |
| ✅ Always | RBAC admin en todos los endpoints nuevos. |
| ✅ Always | Agregación de costo en backend, no en frontend. |
| ⚠️ Ask first | Añadir `cron-parser` + `cronstrue` al package.json (deps del PRD base). |
| ⚠️ Ask first | Migrar `useAutonomousAgent` de `$fetch` a TanStack Query (Q-001). |
| 🚫 Never | Modificar `app.module.ts` — auto-discovery. |
| 🚫 Never | Hardcodear crons, URLs, emails, timezones. |
| 🚫 Never | `console.log` — usar `Logger` (back) o `vue-sonner` (front). |
| 🚫 Never | Escribir entities/services/controllers a mano — usar generadores para nuevos recursos. |
| 🚫 Never | Publicar drafts si `autoApproveDrafts === false`. |

## Supuestos asumidos

- **Asumido**: el PRD `base-ui-components` se implementa primero y provee los componentes FR-001..FR-021. Este PRD los consume.
- **Asumido**: `ext_aa_run.output` ya contiene `promptTokens` y `completionTokens` para runs `generate` (verificado en `job-processor.ts:208-214`). Runs `research`/`publish`/`metrics` no tienen tokens — su aporte al costo es 0.
- **Asumido**: el timezone del usuario (`Intl.DateTimeFormat().resolvedOptions().timeZone`) es suficiente para CronNextRunsPreview. Q-003 del PRD base.
- **Asumido**: los defaults de cron por env (`AUTONOMOUS_AGENT_*_CRON`) son los mismos que los templates `daily` del auto-suggest. Coinciden con `extension.config.ts`.
- **Asumido**: no hay tipos de agente más allá de runTypes (research/generate/publish/metrics). Q-008.
- **Asumido**: el widget `AutonomousAgentDashboard.vue` inyectado en `/app` se refactoriza para usar StatCard del catálogo (mismo PRD base).