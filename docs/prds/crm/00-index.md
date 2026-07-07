---
doc: crm/00-index
title: "CRM Extension — Índice"
status: draft
created: 2026-07-07
---

# CRM Extension — Índice

**Estado**: draft
**Owner**: Foundation
**Creado**: 2026-07-07
**PRD base de referencia**: `docs/prds/base-ui-components/`
**Dependencia**: `auth` (extensión base, sin dependencias entre extensiones)

## Resumen

PRD multi-file para la extensión CRM de Foundation Mono. Define dashboards informativos con componentes base del catálogo (`StatCard`, `TrendChart`, `BarChartCard`, `DonutChartCard`), formularios automatizados (`LinkedSelect`, auto-fill de empresa desde dominio de email) y configuradores de scheduling si aplica (`CronScheduleEditor`). Backend ya existe y funciona — este PRD focaliza en UX/UI, automatización de forms, y extensión de capacidades (trends, MRR, asignación round-robin).

## Tabla de contenidos

| # | Archivo | Resumen |
|---|---------|---------|
| 00 | `00-index.md` | Este índice. Estado, owner, TOC. |
| 01 | `01-overview.md` | Resumen ejecutivo, problema, objetivos, KPIs, no-objetivos. |
| 02 | `02-architecture.md` | Arquitectura actual (back+front), flujo CRM, componentes afectados, matriz de uso FR-NNN base. |
| 03 | `03-requirements.md` | FR-NNN (dashboard, forms automatizados, scheduling, endpoints, RBAC), NFR, criterios de aceptación. |
| 04 | `04-context.md` | Stack, aliases, dependencias, constraints, supuestos. |
| 05 | `05-risks-and-tradeoffs.md` | Riesgos (GDPR, data quality, integraciones) y trade-offs. |
| 07 | `07-open-questions.md` | Q-NNN pendientes de decisión. |
| 08 | `08-definition-of-done.md` | Criterios objetivos para considerar la extensión completa. |

## Componentes base referenciados (del PRD `base-ui-components`)

| FR base | Componente | Uso en CRM |
|---------|-----------|------------|
| FR-001 | `StatCard` | KPIs dashboard (clientes totales, activos, pipeline value, propuestas) |
| FR-002 | `TrendChart` | Trend de clientes nuevos (últimos 30/90 días), trend de interacciones |
| FR-003 | `BarChartCard` | Clientes por stage (funnel), clientes por origen |
| FR-004 | `DonutChartCard` | Distribución de status (lead/discovery/proposed/active/churned) |
| FR-021 | `LinkedSelect` | Cliente → Contacto (al crear interacción), Status → sub-catálogo |
| FR-006 (⚠️) | `CronScheduleEditor` | Si se aprueba scheduling (weekly report, follow-up reminders) |

## Flujo posterior

```
PRD crm (este) → sdd-explore → sdd-propose → sdd-spec → sdd-design → sdd-tasks → sdd-apply → sdd-verify
```