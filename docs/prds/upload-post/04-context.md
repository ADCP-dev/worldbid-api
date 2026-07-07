---
doc: upload-post/04-context
title: "Contexto"
status: draft
created: 2026-07-07
---

# Contexto

## Stack

### Backend (`apps/back/`)
- **Framework**: NestJS + TypeORM + PostgreSQL.
- **Scheduling**: `@nestjs/schedule` 6.1 (registrado globalmente en
  `InfrastructureModule` — no re-importar).
- **Queues**: `@nestjs/bullmq` 11 + `bullmq` 5.68 (instalados, no usados por
  esta extensión hoy — Q-001 evalúa adoptarlos para retry/observabilidad).
- **Email**: `nodemailer` 6.10 + `QueuedMailerService` (`@comms/email-queue`).
- **Validación**: class-validator + class-transformer + `plainToInstance`.

### Frontend (`apps/front/`)
- **Framework**: Nuxt 3 (4.3) + Vue 3.5 + `<script setup lang="ts">`.
- **Styling**: Tailwind 4.1 + DaisyUI 5.5.
- **State**: Pinia 3 + persistedstate.
- **Data fetching**: TanStack Vue Query 5.99 + `useApi()` (auto-import).
- **Forms**: vee-validate 4 + zod 4 + componentes base `@base/ui-app`.
- **Tables**: TanStack Vue Table 8.21.
- **Charts**: ECharts 5.5 + vue-echarts 7.0.3 (consumidos vía wrappers del
  catálogo `base-ui-components`, nunca directo).
- **Calendar**: `Calendar.vue` + `CalendarEvent` de `@base/ui-app/components/calendar/`
  (ya usado en `index.vue`).
- **i18n**: vue-i18n 11 + @nuxtjs/i18n 10. Namespace `upload-post`.
- **Dates**: date-fns 4 + @internationalized/date 3 + Intl nativo.
- **Toasts**: `vue-sonner`.

## Path aliases

| Alias | Destino | Ejemplo |
|-------|---------|---------|
| `@ext/upload-post/*` | `apps/back/src/extensions/upload-post/*` | `import { UploadService } from '@ext/upload-post/services/upload.service'` |
| `@upload-post` | `apps/front/extensions/upload-post` | `import { useUploadPost } from '@upload-post/composables/useUploadPost'` |
| `@base/ui-app/components/...` | `apps/front/modules/base/ui-app/components/` | `import StatCard from '@base/ui-app/components/charts/StatCard.vue'` |
| `@comms/email-queue` | cola de email global | `import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service'` |

## Entidades existentes

| Entidad | Tabla | Campos clave |
|---------|-------|--------------|
| `UpPostEntity` | `ext_uploadpost_post` | `id, jobId, requestId, mediaType, title, caption, platforms[], profileUsername, mediaUrl, status, results, scheduledAt, publishedAt, errorMessage` |
| `UpPostAnalyticsSnapshotEntity` | `ext_uploadpost_analytics_snapshot` | `platform, snapshotDate, followers, reach, views, impressions, likes, comments, shares, saves, profileViews, timeSeries` |
| `UpPostAutodmMonitorEntity` | `ext_uploadpost_autodm_monitor` | cache de AutoDM |
| `UpPostContentIdeaEntity` | `ext_uploadpost_content_idea` | ideas backlog |

**Campos nuevos propuestos**: `tags: string[]` (jsonb, default `[]`),
`autoMetadata: jsonb` (nullable). Se añaden con `pnpm add:extension-property`
+ `pnpm migration:generate` + `pnpm migration:run`. NUNCA hardcode.

## Endpoints existentes relevantes

- Upload: `/upload-post/upload/{video,photo,text,status,history,local}`
- Schedule: `/upload-post/schedule` (GET/PATCH/DELETE)
- Analytics: `/upload-post/analytics/{:profileUsername,total-impressions/:profileUsername,post/:requestId,platform-metrics}`
- Queue: `/upload-post/queue/{preview,next-slot,settings}`
- Platforms: `/upload-post/platforms/{facebook,linkedin,pinterest,google-business,reddit}/...`
- Weekly report: `/upload-post/weekly-report` + `/send`
- Monthly: `/upload-post/monthly-analytics/{summary/:month,history,top-posts,top-posts/:month,send}`

**Endpoints NUEVOS propuestos** (ver `03-requirements.md`):
- `GET /upload-post/dashboard/uploads` (FR-140)
- `GET /upload-post/dashboard/analytics` (FR-141)
- `GET/PUT /upload-post/settings` (FR-142)
- `POST /upload-post/schedule/recurring` (FR-143)

## Crons existentes

| Cron | Default | Source |
|------|---------|--------|
| `dailySnapshot` | `0 23 * * *` | `AnalyticsService` |
| `cleanupOldSnapshots` | `0 2 * * 0` | `AnalyticsService` |
| `scheduledSendReport` | `0 9 * * 1` (env override `UPLOAD_POST_WEEKLY_REPORT_CRON`) | `WeeklyReportService` |

## Env vars

```env
UPLOAD_POST_API_KEY=
UPLOAD_POST_PROFILE_USERNAME=som-os
UPLOAD_POST_WEBHOOK_SECRET=
UPLOAD_POST_WEEKLY_REPORT_CRON=0 9 * * 1
UPLOAD_POST_WEEKLY_REPORT_EMAIL=adrian@som-os.dev
# Propuestas nuevas:
UPLOAD_POST_MAX_FILE_SIZE_MB=500
```

## Config global consumida

- `app.notificationEmail` — fallback si `UPLOAD_POST_WEEKLY_REPORT_EMAIL` no
  está (ver `docs/DECOUPLING.md` §8).
- `QueuedMailerService` — global, no requiere import en el module.

## Constraints (three-tier)

| Tier | Constraint |
|------|------------|
| ✅ Always | Usar `@base/ui-app` components (StatCard, TrendChart, BarChartCard, DonutChartCard, CronScheduleEditor, WeekdayPicker, TimeWindowPicker, CronNextRunsPreview, LinkedSelect, FormMultipleFile). |
| ✅ Always | Path aliases `@ext/upload-post/*`, `@upload-post`, `@base/ui-app/...`. |
| ✅ Always | Prefijo `ext_uploadpost_` en cualquier tabla nueva. |
| ✅ Always | `@Roles(RoleEnum.admin)` en controllers nuevos (salvo webhooks/incoming público). |
| ✅ Always | NestJS `Logger` — no `console.*`. |
| ✅ Always | Generadores Hygen para nuevos resources (`pnpm generate:extension`, `pnpm add:extension-property`). NUNCA escribir entity/service/controller a mano. |
| ✅ Always | Migraciones vía `pnpm migration:generate` + `pnpm migration:run`. NUNCA SQL a mano. |
| ✅ Always | i18n en `apps/front/i18n/locales/{es,en}/upload-post.json`. |
| ✅ Always | `import type` para tipos. `unknown` + guards, no `any`. |
| ⚠️ Ask first | Añadir deps nuevas (e.g. `cron-parser` en back para validar cron en `/settings` — Q-003). |
| ⚠️ Ask first | Mover procesamiento local a cola Bull (Q-001). |
| ⚠️ Ask first | Auto-detección de contenido por IA (Q-004). |
| 🚫 Never | Crear componente custom si ya existe uno base. |
| 🚫 Never | Hardcodear colores, URLs, timezones, tokens, emails. |
| 🚫 Never | Persistir bytes de archivo en la DB (siempre `mediaUrl` + Storage). |
| 🚫 Never | `console.log` en backend o frontend. |
| 🚫 Never | Editar `app.module.ts` (auto-discovery). |

## Supuestos asumidos

- **Asumido**: el catálogo `base-ui-components` (PRD referenciado) estará
  implementado antes que este PRD se ejecute. Si no, los FR-100..113 y
  FR-130..133 se bloquean hasta que el catálogo exista.
- **Asumido**: la API Upload-Post ya soporta todos los endpoints consumidos
  por `UploadPostClientService` (16kb de wrapper). No se requiere añadir
  endpoints externos nuevos salvo `schedule/recurring` (Q-002 evalúa si la
  expansión la hace el backend o la API nativamente).
- **Asumido**: el `profileUsername` es único (single-client). Multi-perfil
  está fuera de scope (Q-005).
- **Asumido**: el timezone del navegador (`Intl...resolvedOptions().timeZone`)
  es suficiente para mostrar próximas ejecuciones; overrides via prop
  `timezone` del catálogo. Q-003 del PRD base cubre el caso configurable.
- **Asumido**: los nuevos endpoints dashboard/settings se generan con
  `pnpm generate:extension` y se registran en `extension.module.ts` + manifest.
- **Asumido**: el cron del reporte semanal se persiste en DB (override del
  env var) — requiere una tabla `ext_uploadpost_settings` nueva o un campo
  en una tabla existente. Detalle de diseño: `sdd-design`.