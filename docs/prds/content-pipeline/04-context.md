---
doc: content-pipeline/04-context
title: "Contexto"
status: draft
created: 2026-07-07
---

# Contexto

## Stack

### Backend

- **Framework**: NestJS + TypeORM + PostgreSQL.
- **Queues**: `@nestjs/bullmq` + BullMQ (Redis). Dos colas: `content-pipeline` (no usada actualmente como cola de procesamiento, solo registrada), `content-pipeline-video` (jobs de video/carousel/template).
- **Processor**: `VideoJobProcessor extends WorkerHost` con `@Processor(CONTENT_PIPELINE_VIDEO_QUEUE)`.
- **Auth**: `@nestjs/passport` JWT + `@Roles(RoleEnum.admin)` + `RolesGuard`.
- **External APIs**: Tavily (research), Ollama Cloud/GLM-5.2 (content), WaveSpeed (images), FFmpeg (video), Chromium headless (HTML→PNG).
- **Logger**: NestJS `Logger` (NO `console.log`).
- **Migrations**: TypeORM CLI (`pnpm migration:generate` + `pnpm migration:run`). NUNCA hardcode.

### Frontend

- **Framework**: Nuxt 3 (4.3.1) + Vue 3.5 + `<script setup lang="ts">`.
- **Styling**: Tailwind CSS 4.1 + DaisyUI 5.5.
- **State**: Pinia 3 + `persistedstate`.
- **Data fetching**: TanStack Vue Query 5.99 + composable local `useContentPipeline()` (define `useApi()` local, NO consume `@/composables/useApi` — deuda técnica, fuera de scope).
- **Forms**: vee-validate 4 + zod 4 + componentes base.
- **Charts**: ECharts 5.5 + vue-echarts 7.0.3 (vía wrappers del catálogo base).
- **i18n**: vue-i18n 11 + @nuxtjs/i18n 10.
- **Toast**: `vue-sonner`.

## Path aliases

| Alias | Destino | Ejemplo |
|-------|---------|---------|
| `@ext/content-pipeline/*` | `apps/back/src/extensions/content-pipeline/*` | `import { DraftService } from '@ext/content-pipeline/services/draft.service'` |
| `@iam/*` | `apps/back/src/modules/iam/*` | `import { Roles } from '@iam/roles/roles.decorator'` |
| `@infra/*` | `apps/back/src/infrastructure/*` | `import { NullableType } from '@infra/utils/types/nullable.type'` |
| `@base/ui-app/components/*` | `apps/front/modules/base/ui-app/components/*` | `import StatCard from '@base/ui-app/components/charts/StatCard.vue'` |
| `@/extensions/content-pipeline/*` | `apps/front/extensions/content-pipeline/*` | `import { useContentPipeline } from '@/extensions/content-pipeline/composables/useContentPipeline'` |

## Dependencias

### Backend (relevantes)

| Dependencia | Rol |
|------------|-----|
| `@nestjs/bullmq` | Registro de colas + `@Processor` + `@InjectQueue` |
| `bullmq` | Queue, Job, Worker — sistema de jobs asíncronos |
| `typeorm` | ORM, entidades, queries |
| `@nestjs/passport` + `passport-jwt` | Auth JWT |
| `class-validator` + `class-transformer` | DTO validation |

### Frontend (relevantes)

| Dependencia | Rol |
|------------|-----|
| Catálogo base `@base/ui-app/components/{charts,scheduling,automation}/` | Componentes UI nuevos (FR-001..FR-021) |
| `echarts` + `vue-echarts` | Render de charts (vía wrappers del catálogo) |
| `cronstrue` + `cron-parser` | Parsing cron → humano + próximas ejecuciones (deps del PRD base, ⚠️ Ask first) |
| `lucide-vue-next` | Iconos |
| `vue-sonner` | Toasts |
| `zod` | Validación de forms |

### Dependencias entre extensiones

| Extensión | Relación |
|-----------|----------|
| `auth` | Hard dependency (todos los endpoints admin-only) |
| `cms` | Soft dependency — `PublishingService` publica a CMS si está presente |
| `upload-post` | Soft dependency — `PublishingService` publica a social si está presente |
| `affiliate` | Soft dependency — `AffiliateInjectorService` inyecta links si está presente |
| `autonomous-agent` | Consumidor de content-pipeline (orquesta via BullMQ + @Cron) |

## Constraints (three-tier)

| Tier | Constraint |
|------|------------|
| ✅ Always | Usar componentes `@base/ui-app/components/{charts,scheduling,automation}/` para dashboards, forms y schedules. |
| ✅ Always | Path aliases `@ext/content-pipeline/*`, `@base/ui-app/components/*`, `@/extensions/content-pipeline/*`. |
| ✅ Always | NestJS `Logger` — NO `console.log`. |
| ✅ Always | `@Roles(RoleEnum.admin)` + `RolesGuard` en todos los endpoints. |
| ✅ Always | Tablas con prefijo `ext_cp_` (ya existe: `ext_cp_project`, `ext_cp_idea`, `ext_cp_draft`, `ext_cp_metrics`, `ext_cp_cta_video`). |
| ✅ Always | Migraciones via `pnpm migration:generate` + `pnpm migration:run`. NUNCA hardcode SQL. |
| ✅ Always | i18n en `apps/front/i18n/locales/{es,en}/content-pipeline.json`, namespace `content-pipeline`. |
| ✅ Always | DaisyUI semantic classes + `useThemeColors()` para charts. |
| ✅ Always | TypeScript estricto, `import type` para tipos. |
| ⚠️ Ask first | Añadir columna `scheduleCron` + `scheduleEnabled` a `ext_cp_project` (migración nueva). |
| ⚠️ Ask first | Añadir catálogo estático de templates de steps (¿en código, en DB, en JSON?). |
| ⚠️ Ask first | Habilitar NestJS Cache (`@nestjs/cache-manager`) para `operationalDashboard()`. |
| 🚫 Never | Crear componente UI custom si ya existe uno base en `@base/ui-app/`. |
| 🚫 Never | Hardcodear colores, URLs, timezones, cron strings. |
| 🚫 Never | `console.log` — usar `Logger` (back) o `vue-sonner` (front). |
| 🚫 Never | Escribir entities/services/controllers a mano — usar generadores Hygen para nuevos recursos. |
| 🚫 Never | Sobre-especificar implementación de IA (Tavily, Ollama, WaveSpeed) — fuera de scope. |

## Supuestos asumidos

- **Asumido**: el PRD base `docs/prds/base-ui-components/` será implementado ANTES que este PRD. Los componentes `StatCard`, `TrendChart`, `BarChartCard`, `DonutChartCard`, `GaugeChartCard`, `CronScheduleEditor`, `WeekdayPicker`, `CronNextRunsPreview`, `KeyValueEditor`, `LinkedSelect` existirán en `@base/ui-app/components/`.
- **Asumido**: el mismatch entre `DashboardData` (front) y `DashboardSummary` (back) se resuelve creando `operationalDashboard()` nuevo y dejando `dashboard()` existente para performance post-publish. El frontend deja de consumir `getDashboard()` para KPIs operativos.
- **Asumido**: el cron se persiste en `ext_cp_project.scheduleCron` (nueva columna). La ejecución real del cron requiere un `@Cron` dinámico o un scheduler que lea la columna — `[NEEDS CLARIFICATION]` ver Q-CP-006.
- **Asumido**: el composable local `useApi()` en `useContentPipeline.ts` no se refactoriza a `@/composables/useApi` central (deuda técnica, fuera de scope).
- **Asumido**: `autonomous-agent` sigue siendo el orquestador principal. El scheduling standalone de content-pipeline es opt-in para pipelines que no requieren orquestación completa.
- **Asumido**: el catálogo de templates de steps es estático en código (mapa `contentType → steps[]`) y vive en `services/step-templates.ts` o similar. No requiere DB. `[NEEDS CLARIFICATION]` ver Q-CP-005.