---
doc: cms/00-index
title: "CMS Extension — PRD Índice"
status: draft
created: 2026-07-07
---

# CMS Extension — PRD Índice

**Estado**: draft
**Owner**: Foundation
**Creado**: 2026-07-07
**Dependencias**: auth, storage, translations
**Hijo**: cms-audit
**Referencia base**: `docs/prds/base-ui-components/`

## Resumen

PRD para la extensión CMS de Foundation Mono. Mejora el dashboard (charts reales vía componentes base), automatiza formularios de creación de posts (auto-slug, auto-author, auto-excerpt, LinkedSelect categoría+tags) y añade publicación programada de posts mediante `CronScheduleEditor` + `WeekdayPicker` + `CronNextRunsPreview` con un cronjob backend que procesa la cola de publicaciones pendientes.

## Tabla de contenidos

| # | Archivo | Resumen |
|---|---------|---------|
| 00 | `00-index.md` | Este índice. Estado, owner, TOC. |
| 01 | `01-overview.md` | Problema, objetivos, no-objetivos, KPIs. |
| 02 | `02-architecture.md` | Arquitectura actual, flujo CMS, componentes afectados, matriz de uso. |
| 03 | `03-requirements.md` | FR-NNN dashboard, forms automatizados, scheduling, endpoints, RBAC. NFR. |
| 04 | `04-context.md` | Stack, aliases, dependencias, constraints, supuestos. |
| 05 | `05-risks-and-tradeoffs.md` | Riesgos SEO, multi-idioma, conflictos edición, performance. |
| 06 | `06-migration-phases.md` | Fases de migración (forms actuales → base + scheduling). |
| 07 | `07-open-questions.md` | Q-NNN pendientes de decisión. |
| 08 | `08-definition-of-done.md` | Criterios objetivos para considerar la feature completa. |

## Componentes base referenciados

| FR base | Componente | Uso en CMS |
|---------|-----------|------------|
| FR-001 | `StatCard` | KPIs dashboard (publicados, borradores, programados, views) |
| FR-002 | `TrendChart` | Publicaciones por día/mes, views trend |
| FR-003 | `BarChartCard` | Posts por categoría, por autor |
| FR-004 | `DonutChartCard` | Distribución por estado / por categoría |
| FR-006 | `CronScheduleEditor` | Programar publicación de post |
| FR-007 | `WeekdayPicker` | Subcomponente de CronScheduleEditor |
| FR-009 | `CronNextRunsPreview` | Próximas publicaciones programadas |
| FR-011 | `LinkedSelect` | Categoría (A) → Tags filtrados por categoría (B) |

## Flujo posterior

```
PRD base-ui-components (✅) → PRD cms (este) → sdd-explore → sdd-propose → ...
```