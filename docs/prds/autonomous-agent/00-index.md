---
doc: autonomous-agent/00-index
title: "Autonomous Agent — PRD Índice"
status: draft
created: 2026-07-07
---

# Autonomous Agent — PRD Índice

**Estado**: draft
**Owner**: Foundation
**Creado**: 2026-07-07
**PRD base referenciado**: `docs/prds/base-ui-components/`

## Resumen

Mejora de la extensión **Autonomous Agent** (`apps/back/src/extensions/autonomous-agent/` + `apps/front/extensions/autonomous-agent/`) para ofrecer dashboards informativos con KPIs reales (agentes activos, runs, éxito/error, costo en tokens, throughput, last/next run), formularios automatizados (auto-suggest, auto-fill desde template, LinkedSelect pipeline+steps) y configuradores de scheduling visuales con días de la semana (CronScheduleEditor + WeekdayPicker + CronNextRunsPreview) en lugar de los inputs cron crudos actuales.

## Tabla de contenidos

| # | Archivo | Resumen |
|---|---------|---------|
| 00 | `00-index.md` | Este índice. Estado, owner, TOC. |
| 01 | `01-overview.md` | Problema, objetivos, no-objetivos, KPIs. |
| 02 | `02-architecture.md` | Arquitectura actual, flujo agente→pipeline→output, componentes afectados, matriz de uso de FR base. |
| 03 | `03-requirements.md` | FR dashboard, FR forms automatizados, FR scheduling, FR endpoints, FR RBAC. NFR. |
| 04 | `04-context.md` | Stack, aliases, dependencias, constraints, supuestos. |
| 05 | `05-risks-and-tradeoffs.md` | Riesgos (acciones destructivas, rate limit, approval flow), trade-offs. |
| 06 | `06-migration-phases.md` | Fases de refactor de dashboard y scheduling actual → nuevos componentes. |
| 07 | `07-open-questions.md` | Q-NNN pendientes. |
| 08 | `08-definition-of-done.md` | Criterios objetivos de completitud. |

## Componentes base referenciados (de `base-ui-components`)

| FR base | Componente | Uso en este PRD |
|---------|-----------|-----------------|
| FR-001 | StatCard | KPIs del dashboard |
| FR-002 | TrendChart | Runs en el tiempo, throughput |
| FR-003 | BarChartCard | Distribución por runType |
| FR-004 | DonutChartCard | Distribución por status |
| FR-005 | GaugeChartCard | Tasa de éxito |
| FR-010 | CronScheduleEditor | Reemplaza inputs cron crudos |
| FR-011 | WeekdayPicker | Subcomponente de CronScheduleEditor (weekly) |
| FR-012 | TimeWindowPicker | [NEEDS CLARIFICATION] ventanas de ejecución |
| FR-013 | CronNextRunsPreview | Próximas ejecuciones en form |
| FR-020 | KeyValueEditor | [NEEDS CLARIFICATION] feedbackData avanzado |
| FR-021 | LinkedSelect | Project → pipeline step |

## Flujo posterior

```
PRD base-ui-components (catálogo) → este PRD → sdd-explore → sdd-propose → sdd-spec → ...
```