---
doc: upload-post/08-definition-of-done
title: "Definition of Done"
status: draft
created: 2026-07-07
---

# Definition of Done

La extensión Upload Post está completa cuando TODOS los criterios están verdes.

## Frontend — Dashboards

- [ ] `/app/upload-post` (`index.vue`) renderiza:
  - [ ] 6 StatCards (uploads hoy, semana, mes, programados, publicados, success rate) — FR-100
  - [ ] TrendChart uploads últimos 30 días — FR-101
  - [ ] BarChartCard uploads por día (14d) — FR-102
  - [ ] DonutChartCard distribución de status — FR-103
- [ ] `/app/upload-post/analytics` (`analytics.vue`) renderiza:
  - [ ] StatCards por plataforma (followers, reach, views, engagement) — FR-110
  - [ ] TrendChart reach/views 30d por plataforma seleccionada — FR-111
  - [ ] BarChartCard reach por plataforma (7d) — FR-112
  - [ ] DonutChartCard share de impresiones (7d) — FR-113
- [ ] Todos los charts provienen de `@base/ui-app/components/charts/` —
      ningún `VChart`/`echarts` import directo en `extensions/upload-post/`.
- [ ] `useThemeColors()` consumido (no colores hardcodeados).

## Frontend — Forms automatizados

- [ ] `upload.vue` usa `FormMultipleFile` con drag-drop — FR-120
- [ ] Auto-detección `mediaType` desde MIME al drop — FR-120
- [ ] Auto-extracción título desde filename + EXIF básico (foto) — FR-121
- [ ] Tags auto-sugeridos desde filename tokens (MVP, sin IA) — FR-122
- [ ] `LinkedSelect` plataforma→destino con 3 plataformas con sub-destino
      (Pinterest board, Reddit subreddit, GBP location) — FR-123
- [ ] Auto-suggest `scheduledDate` desde `/queue/next-slot` — FR-124
- [ ] `PlatformDestinationSelect.vue` wrapper local creado

## Frontend — Scheduling

- [ ] `/app/upload-post/settings` nueva página con `CronScheduleEditor`
      para el reporte semanal — FR-130
- [ ] `WeekdayPicker` integrado en modo weekly — FR-131
- [ ] `TimeWindowPicker` en `/app/upload-post/schedule` — FR-132
- [ ] `CronNextRunsPreview` junto a cada `CronScheduleEditor` — FR-133
- [ ] `/app/upload-post/schedule` nueva página con schedule recurrente — FR-134

## Backend — Endpoints nuevos

- [ ] `GET /upload-post/dashboard/uploads` — FR-140
- [ ] `GET /upload-post/dashboard/analytics?days=30` — FR-141
- [ ] `GET /upload-post/settings` + `PUT /upload-post/settings` — FR-142
- [ ] `POST /upload-post/schedule/recurring` — FR-143
- [ ] Todos generados con `pnpm generate:extension` (no escritos a mano)
- [ ] Todos con `@Roles(RoleEnum.admin)` salvo webhooks/incoming — FR-150
- [ ] `extension.manifest.ts` actualizado con las rutas nuevas
- [ ] `extension.module.ts` registra controllers + services nuevos

## Backend — Entidades

- [ ] `UpPostEntity.tags: string[]` añadido vía `pnpm add:extension-property`
- [ ] `UpPostEntity.autoMetadata: jsonb` añadido vía `pnpm add:extension-property`
- [ ] Migración generada con `pnpm migration:generate AddUploadPostTagsAndMetadata`
- [ ] Migración ejecutada con `pnpm migration:run`
- [ ] Si se introduce `ext_uploadpost_settings`, prefijo correcto + migración

## Backend — Crons y settings

- [ ] Cron del reporte semanal persistido en DB con override de env var
- [ ] Si Q-008 = dinámico: `SettingsService` re-registra el job al guardar
- [ ] Validación de cron con `cron-parser` (si Q-003 aprobado)
- [ ] `Logger` en toda transición de status de `UpPostEntity` — NFR-105

## Backend — Webhook security

- [ ] `WebhooksService.handleIncoming` valida firma HMAC con
      `UPLOAD_POST_WEBHOOK_SECRET` (si Q-009 confirma header)
- [ ] Si no hay secreto configurado, endpoint devuelve 403

## i18n

- [ ] `apps/front/i18n/locales/es/upload-post.json` creado con namespace
      `upload-post` cubriendo: dashboard labels, empty-states, schedule
      prompts, "próximas ejecuciones", timezone labels, "subir archivo",
      "arrastra archivos aquí", "auto-detectado", "programar", "ventana
      horaria", "destino", "plataforma".
- [ ] `apps/front/i18n/locales/en/upload-post.json` con las mismas keys
- [ ] Ningún string user-facing hardcodeado en `.vue`

## Testing

- [ ] Backend: tests unit para `DashboardService` (agregaciones happy + empty)
- [ ] Backend: tests unit para `SettingsService` (PUT valida cron, persiste)
- [ ] Backend: test e2e `POST /schedule/recurring` rechaza `untilDate` pasado
- [ ] Backend: test e2e `PUT /settings` requiere admin (403 si no)
- [ ] Frontend: test component `PlatformDestinationSelect` (A cambia → B
      reset + autoFill, plataformas sin sub-destino ocultan B)
- [ ] Frontend: test `upload.vue` auto-detect MIME (video/photo/text)
- [ ] Tests usan `it("should ...")` (regla ESLint)

## Accesibilidad

- [ ] Dropzone con `role="button"`, `aria-label`, activación Enter/Space
- [ ] Charts con `a11yTable` prop donde aplique (Donut de status)
- [ ] Tab order en `CronScheduleEditor` navegable

## Quality gates

- [ ] `pnpm lint` verdes (apps/back + apps/front)
- [ ] `pnpm check-types` verdes
- [ ] `pnpm format` (Prettier) aplicado a archivos nuevos
- [ ] Sin `console.*` en backend ni frontend
- [ ] Sin `any` — `unknown` + guards donde haga falta

## Documentación

- [ ] `docs/extensions/upload-post.md` actualizado con:
  - Nuevos endpoints (dashboard, settings, schedule/recurring)
  - Nuevas páginas frontend (settings.vue, schedule.vue)
  - Nuevos campos en `UpPostEntity` (tags, autoMetadata)
  - Matriz de componentes base consumidos
- [ ] YAML frontmatter válido en el doc
- [ ] `pnpm docs:sync` ejecutado y `docs/ARCHITECTURE.md` regenerado
- [ ] Skill registry no requiere update (no se añaden skills)

## Cierre

- [ ] Decisiones clave guardadas en Engram (`mem_save`):
  - Decisión T-01 (snapshots vs live), T-04 (DB cron override),
    T-06 (expansión recurrente MVP).
  - Bug/riesgo R-04 (cron dinámico) y R-09 (webhook firma).
- [ ] Commit con conventional commit (`feat(upload-post): ...`)
- [ ] PR creado referenciando este PRD (`docs/prds/upload-post/`)
- [ ] Open questions resueltas cerradas en `07-open-questions.md` con
      decisión y fecha
- [ ] `AGENTS.md` no requiere cambios (no hay reglas nuevas)