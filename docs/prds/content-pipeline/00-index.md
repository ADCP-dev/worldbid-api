---
doc: content-pipeline/00-index
title: "Content Pipeline — PRD Índice"
status: draft
created: 2026-07-07
---

# Content Pipeline — PRD Índice

**Estado**: draft
**Owner**: Foundation
**Creado**: 2026-07-07
**PRD base referenciado**: `docs/prds/base-ui-components/` (FR-001..FR-021)

## Resumen

PRD de producto para la extensión **Content Pipeline**: dashboards operativos con info relevante (stages, throughput, latencia, queue status, success rate), forms automatizados (auto-suggest de steps, LinkedSelect source→destination, KeyValueEditor para config de steps) y scheduling de pipelines recurrentes (CronScheduleEditor + WeekdayPicker + CronNextRunsPreview). Consume componentes del catálogo base `@base/ui-app/components/{charts,scheduling,automation}/`.

## Tabla de contenidos

| # | Archivo | Resumen |
|---|---------|---------|
| 00 | `00-index.md` | Este índice. Estado, owner, TOC. |
| 01 | `01-overview.md` | Problema, objetivos, no-objetivos, KPIs. |
| 02 | `02-architecture.md` | Pipeline actual, stages, queues, flujo, matriz uso FR base, componentes afectados. |
| 03 | `03-requirements.md` | FR-CP-NNN (dashboards, forms, scheduling, endpoints, RBAC) + NFR-CP-NNN. |
| 04 | `04-context.md` | Stack, aliases, dependencias, constraints, supuestos. |
| 05 | `05-risks-and-tradeoffs.md` | Cuellos de botella, fallos en cascada, trade-offs. |
| 06 | `06-migration-phases.md` | Refactor del dashboard ad-hoc existente a componentes base. |
| 07 | `07-open-questions.md` | Q-CP-NNN pendientes. |
| 08 | `08-definition-of-done.md` | Criterios objetivos: tests, lint, doc YAML, PR. |

## Componentes base referenciados (de `docs/prds/base-ui-components/03-requirements.md`)

| FR base | Componente | Uso en content-pipeline |
|---------|-----------|--------------------------|
| FR-001 | `StatCard` | KPIs: items en cola, completados, fallidos, throughput |
| FR-002 | `TrendChart` | Throughput (items/hora) en el tiempo, latencia end-to-end |
| FR-003 | `BarChartCard` | Tiempo promedio por stage, top fuentes |
| FR-004 | `DonutChartCard` | Distribución de status (draft/approved/published/rejected) |
| FR-005 | `GaugeChartCard` | Success rate (0-100%) |
| FR-006 | `CronScheduleEditor` | Schedule de pipelines recurrentes |
| FR-007 | `WeekdayPicker` | Días de la semana para schedule semanal |
| FR-009 | `CronNextRunsPreview` | Próximas ejecuciones del pipeline |
| FR-010 | `KeyValueEditor` | Config de steps del pipeline |
| FR-011 | `LinkedSelect` | Source + destination encadenados |

## Flujo posterior

```
PRD content-pipeline (este) → sdd-explore → sdd-propose → sdd-spec → sdd-design → sdd-tasks → sdd-apply → sdd-verify → sdd-archive
```