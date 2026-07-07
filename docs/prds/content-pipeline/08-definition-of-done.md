---
doc: content-pipeline/08-definition-of-done
title: "Definition of Done"
status: draft
created: 2026-07-07
---

# Definition of Done

Content Pipeline PRD está completo cuando TODOS los siguientes criterios están verdes, por fase.

## Fase 0 — Backend contrato

- [ ] `MetricsService.operationalDashboard()` implementado con payload tipado: `kpis`, `throughputSeries`, `stageTimes`, `topSources`, `draftsByStatus`, `successRate`.
- [ ] `GET /content-pipeline/operational-dashboard` expuesto con `@Roles(RoleEnum.admin)`.
- [ ] `VideoQueueService.getQueueStats()` implementado (BullMQ counts).
- [ ] `GET /content-pipeline/queue/stats` expuesto con `@Roles(RoleEnum.admin)`.
- [ ] `PATCH /content-pipeline/projects/:id/schedule` expuesto con validación de sintaxis cron.
- [ ] Tipos compartidos en `apps/front/extensions/content-pipeline/types.ts` alineados con payload real (sin `any`, sin `?? 0` por mismatch).
- [ ] Tests unitarios:
  - `operationalDashboard()` retorna payload tipado con datos vacíos y con datos.
  - `getQueueStats()` retorna counts BullMQ.
  - Validación de cron rechaza strings inválidos (HTTP 400).
- [ ] Migración `AddScheduleCronToProject` generada via `pnpm migration:generate` y aplicada via `pnpm migration:run`.
- [ ] `pnpm lint` + `pnpm check-types` verdes en apps/back.

## Fase 1 — Dashboard refactor

- [ ] `pages/app/content-pipeline/index.vue` refactorizado, importa componentes de `@base/ui-app/components/charts/`.
- [ ] `components/ContentPipelineDashboard.vue` refactorizado a `StatCard` grid.
- [ ] ≥6 `StatCard` renderizados: items en cola, activos, completados 24h, fallidos 24h, throughput, latencia p50.
- [ ] `TrendChart` throughput 24h renderizado.
- [ ] `BarChartCard` tiempo por stage renderizado.
- [ ] `BarChartCard` top sources renderizado.
- [ ] `DonutChartCard` distribución de status de drafts renderizado.
- [ ] `GaugeChartCard` success rate renderizado con thresholds (95 success, <80 error).
- [ ] `useContentPipeline.ts` expone `getOperationalDashboard()`, `getQueueStats()`.
- [ ] 0 `.stat` + lucide inline en dashboard page.
- [ ] 0 barras custom de "Ideas by Status" / "Drafts by Status".
- [ ] i18n keys creadas en `apps/front/i18n/locales/{es,en}/content-pipeline.json` (namespace `content-pipeline`).
- [ ] `pnpm lint` + `pnpm check-types` verdes en apps/front.

## Fase 2 — Forms automatizados

- [ ] `pages/app/content-pipeline/projects/create.vue` usa `LinkedSelect` source→destination.
- [ ] `pages/app/content-pipeline/projects/[id].vue` (edit) usa `KeyValueEditor` para config de steps.
- [ ] `composables/useStepTemplates.ts` creado con catálogo estático (6 contentTypes).
- [ ] Auto-suggest de steps al seleccionar `contentType` funciona (aceptar/modificar/rechazar).
- [ ] Auto-fill de config desde template de pipeline funciona.
- [ ] `LinkedSelect`: cambiar source resetea destination, `autoFill` cuando 1 opción.
- [ ] `KeyValueEditor`: valida keys duplicadas, soporta `valueType` string/number/boolean.
- [ ] Tests component:
  - `LinkedSelect` reset + autoFill.
  - `KeyValueEditor` duplicate key invalida.
  - Auto-suggest sugiere steps correctos por `contentType`.

## Fase 3 — Scheduling

- [ ] `pages/app/content-pipeline/schedules.vue` creada.
- [ ] `CronScheduleEditor` con modos minutes/daily/weekly/monthly/advanced.
- [ ] `WeekdayPicker` integrado en modo weekly.
- [ ] `CronNextRunsPreview` muestra próximas 5 ejecuciones.
- [ ] `FormSwitch` activa/desactiva schedule por project.
- [ ] `PATCH /projects/:id/schedule` persiste `scheduleCron` + `scheduleEnabled`.
- [ ] Cron inválido retorna HTTP 400.
- [ ] `SchedulerService` ejecuta cron dinámico (si Q-CP-006 resuelto).
- [ ] Tests:
  - CronScheduleEditor cada modo produce cron correcto.
  - CronNextRunsPreview cron inválido muestra error.
  - PATCH persiste y valida.

## Cross-cutting

- [ ] Todos los endpoints con `@Roles(RoleEnum.admin)` + `RolesGuard`.
- [ ] Todos los servicios usan NestJS `Logger` (no `console.log`).
- [ ] Todos los componentes front usan DaisyUI semantic classes + `useThemeColors()` (no colores hardcodeados).
- [ ] Path aliases usados (`@ext/content-pipeline/*`, `@base/ui-app/components/*`, `@/extensions/content-pipeline/*`). 0 rutas relativas largas.
- [ ] `import type` para tipos.
- [ ] Accesibilidad: ARIA roles, keyboard nav, `a11yTable` en charts.
- [ ] i18n: 0 strings hardcodeados user-facing.

## Documentación

- [ ] `docs/extensions/content-pipeline.md` actualizado con nuevos endpoints (`operational-dashboard`, `queue/stats`, `schedule`) y página `schedules.vue`.
- [ ] YAML frontmatter válido.
- [ ] `pnpm docs:sync` ejecutado y `docs/ARCHITECTURE.md` regenerado.
- [ ] `bin/generate-ui-components-list.js` ejecutado si se añadieron componentes (no aplica aquí — solo se consumen).

## Cierre

- [ ] `pnpm lint` + `pnpm check-types` verdes en ambos workspaces.
- [ ] `pnpm format` aplicado.
- [ ] Decisiones clave guardadas en Engram (`mem_save`):
  - D-CP-01 (endpoint separado), D-CP-02 (queue stats BullMQ), D-CP-04 (scheduling standalone), R-CP-04 (mismatch contrato).
- [ ] PR creado referenciando este PRD (`docs/prds/content-pipeline/`).
- [ ] Open questions resueltas o marcadas como fuera de scope con justificación.
- [ ] Conventional commit: `docs: add content-pipeline PRD`.