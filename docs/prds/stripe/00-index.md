---
doc: stripe/00-index
title: "Stripe Billing — PRD Index"
status: draft
created: 2026-07-07
---

# PRD: Stripe Billing Extension — Index

## Resumen

PRD multi-file para la extensión **Stripe Billing** de Foundation Mono. Cubre dashboards de métricas de billing (MRR/ARR/churn), automatización de creación de planes (auto-gen de prices en Stripe), y scheduling configurable de sync/reconciliación con Stripe vía cronjobs.

## Estado

- **status**: draft
- **owner**: [NEEDS CLARIFICATION]
- **created**: 2026-07-07
- **input**: `docs/PRD-stripe-module.md` (PRD previo v1, alta cobertura funcional ya implementada)

## Tabla de contenidos

| # | Archivo | Contenido |
|---|---------|-----------|
| 00 | `00-index.md` | Este archivo |
| 01 | `01-overview.md` | Problema, objetivos, no-objetivos, KPIs |
| 02 | `02-architecture.md` | Arquitectura actual, flujo, componentes afectados, matriz uso |
| 03 | `03-requirements.md` | FR-NNN + NFR-NNN con EARS |
| 04 | `04-context.md` | Stack, aliases, dependencias, constraints |
| 05 | `05-risks-and-tradeoffs.md` | Riesgos y trade-offs |
| 06 | `06-migration-phases.md` | Fases de refactor incremental |
| 07 | `07-open-questions.md` | Q-NNN pendientes |
| 08 | `08-definition-of-done.md` | Criterios de cierre |

## Componentes base-ui referenciados

Del PRD `docs/prds/base-ui-components/03-requirements.md`:

| Componente | FR base | Uso en Stripe |
|------------|---------|---------------|
| StatCard | FR-001 | MRR, ARR, suscripciones activas, trials, fallos pago |
| TrendChart | FR-002 | MRR trend, ARR trend |
| BarChartCard | FR-003 | Revenue por plan |
| DonutChartCard | FR-004 | Distribución de status de suscripciones |
| GaugeChartCard | FR-005 | Churn rate |
| CronScheduleEditor | FR-010 | Schedule de sync/reconciliación |
| WeekdayPicker | FR-011 | Sub-componente de CronScheduleEditor (weekly) |
| LinkedSelect | FR-021 | Product → Price en form de planes |

> **Nota sobre numeración**: el brief del task referenciaba FR-006/FR-007/FR-011 para scheduling/LinkedSelect, pero el PRD base (fuente de verdad) los numera como FR-010/FR-011/FR-021. Este PRD usa la numeración del base.