---
doc: autonomous-agent/06-migration-phases
title: "Autonomous Agent — Fases de Migración"
status: draft
created: 2026-07-07
---

# Fases de Migración

Refactor incremental del frontend actual (dashboards crudos + inputs cron) hacia los nuevos componentes base. El backend recibe endpoints de agregación nuevos. No hay breaking changes de schema.

## Fase 0 — Prerequisitos

**Objetivo**: PRD `base-ui-components` implementado y disponible en `@base/ui-app/components/{charts,scheduling,automation}/`.

**Criterios de salida**:
- [ ] `StatCard`, `TrendChart`, `BarChartCard`, `DonutChartCard`, `GaugeChartCard` existen y pasan sus tests.
- [ ] `CronScheduleEditor`, `WeekdayPicker`, `TimeWindowPicker`, `CronNextRunsPreview` existen y pasan sus tests.
- [ ] `LinkedSelect`, `KeyValueEditor` existen y pasan sus tests.
- [ ] `cronstrue` + `cron-parser` instalados en `apps/front/package.json`.
- [ ] Namespace `base-ui` en `i18n/locales/{es,en}/`.

**Rollback**: si el PRD base no se completa, este PRD queda bloqueado.

## Fase 1 — Backend: endpoints de stats

**Objetivo**: añadir agregación de costo y stats.

**Entregables**:
- `GET /v1/autonomous-agent/runs/stats` (FR-121) — totalRuns, runsToday, successRate, byRunType, byStatus, costTokens, trend[], lastRun.
- `GET /v1/autonomous-agent/configs/:id/stats` (FR-122) — costTokens, runsCount, successRate, lastRun, nextRun.
- `AgentRunService.getStats()` con query SQL de agregación.
- `AgentConfigService.getStats(id)` con nextRun calculado via `cron-parser` (backend).
- Tests unitarios de ambos endpoints.
- DTOs `find-stats.dto.ts` con `from`/`to`/`projectId` opcionales.

**Criterios de salida**:
- [ ] `curl /v1/autonomous-agent/runs/stats` retorna JSON shape correcto.
- [ ] `curl /v1/autonomous-agent/configs/:id/stats` retorna nextRun correcto.
- [ ] Tests pasan.
- [ ] RBAC admin verificado (403 para no-admin).

**Rollback**: revertir los 2 endpoints + servicio. No afecta al frontend existente (no los consume aún).

## Fase 2 — Frontend: dashboard refactor

**Objetivo**: reemplazar KPIs crudos por componentes base.

**Entregables**:
- `composables/useAutonomousAgent.ts`: añadir `getStats()`, `getConfigStats(id)`.
- `pages/app/autonomous-agent/index.vue`: 8 StatCard (FR-101), TrendChart (FR-102), BarChartCard (FR-103), DonutChartCard (FR-104), GaugeChartCard (FR-105), costo (FR-106).
- `components/AutonomousAgentDashboard.vue`: refactor widget a StatCard mínimo (3 cards).
- `i18n/locales/{es,en}/autonomous-agent.json`: namespace nuevo.
- Render progressive (skeleton en stats).

**Criterios de salida**:
- [ ] Dashboard muestra 8 KPIs con StatCard.
- [ ] Charts renderizan con `useThemeColors()`.
- [ ] Empty-states visibles cuando no hay runs.
- [ ] Responsive mobile (grid-cols-1) y desktop (grid-cols-4).
- [ ] i18n es/en completo.
- [ ] Lighthouse a11y ≥ 90.

**Rollback**: revertir `index.vue` y `AutonomousAgentDashboard.vue` a versión anterior. El backend de Fase 1 queda (es harmless).

## Fase 3 — Frontend: forms con CronScheduleEditor

**Objetivo**: reemplazar inputs cron crudos por editores visuales + preview.

**Entregables**:
- `pages/app/autonomous-agent/configs/create.vue`: 4 CronScheduleEditor (FR-110) + WeekdayPicker (FR-111) + CronNextRunsPreview (FR-112) + auto-suggest templates (FR-113) + LinkedSelect (FR-114) + auto-fill (FR-115).
- `pages/app/autonomous-agent/configs/[id].vue`: igual + last run / next run (FR-107) + StatCard costo config (FR-106).
- Quitar `cronRegex` manual de los schemas zod — la validación la hace CronScheduleEditor.
- Modal de confirmación al activar `autoApproveDrafts` (R-06).

**Criterios de salida**:
- [ ] No hay inputs cron crudos en create/edit.
- [ ] WeekdayPicker muestra días en locale correcto.
- [ ] CronNextRunsPreview muestra 5 próximas ejecuciones por phase.
- [ ] Template `daily` auto-fill los 4 editores correctamente.
- [ ] Editar un cron tras template cambia el select a `custom`.
- [ ] Validación zod pasa cuando CronScheduleEditor emite cron válido.
- [ ] Modal de confirmación aparece al activar autoApproveDrafts.

**Rollback**: revertir los 2 archivos vue. El composable de Fase 2 queda.

## Fase 4 — Tests y DoD

**Objetivo**: cobertura y gates finales.

**Entregables**:
- Tests Vitest de `index.vue`, `create.vue`, `[id].vue` (mount + props + emits).
- Test e2e (Playwright) de flujo: crear config con template → ver preview → guardar → ver en dashboard.
- `pnpm check-types` pasa.
- `pnpm lint` pasa.
- `docs/extensions/autonomous-agent.md` actualizado con nuevos endpoints y componentes.
- `pnpm docs:sync` ejecutado.

**Criterios de salida**: ver `08-definition-of-done.md`.

**Rollback**: N/A (tests no son rollbackables).