---
doc: affiliate/00-index
title: "Affiliate Program — Índice"
status: draft
created: 2026-07-07
---

# Affiliate Program — Índice

**Estado**: draft
**Owner**: Foundation
**Creado**: 2026-07-07
**PRD**: segundo de la serie (referencia al catálogo base `docs/prds/base-ui-components/`)

## Resumen

PRD de la extensión `affiliate` (programa de afiliados). Mejora los dashboards (admin + portal) con KPIs relevantes usando los componentes base del catálogo, automatiza los formularios (auto-generate de código de partner, auto-fill de cliente/email, cálculo automático de comisión), y hace entendible el cronjob mensual de reporte (`@Cron('0 23 28-31 * *')`) usando `CronScheduleEditor`.

## Tabla de contenidos

| # | Archivo | Resumen |
|---|---------|---------|
| 00 | `00-index.md` | Este índice. Estado, owner, TOC. |
| 01 | `01-overview.md` | Resumen ejecutivo, problema, objetivos, KPIs, no-objetivos. |
| 02 | `02-architecture.md` | Arquitectura actual (back + front), flujo de datos, matriz componente-base × uso. |
| 03 | `03-requirements.md` | FR-NNN (dashboard, forms, scheduling, endpoints), NFR, criterios de aceptación. |
| 04 | `04-context.md` | Stack, aliases, dependencias, constraints, supuestos. |
| 05 | `05-risks-and-tradeoffs.md` | Riesgos (dinero, agregados) y trade-offs. |
| 06 | `06-migration-phases.md` | Fases de migración del dashboard y forms actuales a componentes base. |
| 07 | `07-open-questions.md` | Q-NNN pendientes. |
| 08 | `08-definition-of-done.md` | Criterios objetivos para considerar la mejora completa. |

## Componentes base referenciados (del PRD `base-ui-components`)

| Componente | FR base | Uso en affiliate |
|------------|---------|-------------------|
| `StatCard` | FR-001 | KPIs del dashboard admin + portal |
| `TrendChart` | FR-002 | Trend mensual de comisiones pagadas |
| `BarChartCard` | FR-003 | Top partners por revenue; comisiones por mes |
| `DonutChartCard` | FR-004 | Distribución de comisiones por estado |
| `GaugeChartCard` | FR-005 | Tasa de conversión global (pendiente → converted) |
| `CronScheduleEditor` | FR-010 | Edición del cronjob mensual de reporte |
| `WeekdayPicker` | FR-011 | Subcomponente de CronScheduleEditor (no usado directo aquí) |
| `CronNextRunsPreview` | FR-013 | Próximas ejecuciones del reporte |
| `LinkedSelect` | FR-021 | Forms: partner → cliente; referral → proyecto |

## Flujo posterior

```
PRD base-ui-components (catálogo) → este PRD → sdd-explore → sdd-propose → ... → sdd-apply
```